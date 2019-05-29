import {
  SyncBailHook,
  SyncHook,
  AsyncSeriesWaterfallHook,
  AsyncSeriesHook,
  AsyncParallelBailHook,
  AsyncParallelHook,
} from "tapable";
import { Application, Context } from "probot";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { fetchConfig, Config } from "./config";
import { Plugin, AppPlugin, PullRequestPlugin, UninitializedPlugin } from "./plugin";
import { ReposCreateStatusParams } from "@octokit/rest";
import to from "await-to-js";
import { getLogger } from "./utils/logger";

const logger = getLogger("autobot");

/**
 * Used to describe the different environments a plugin can run in. All
 * hooks are defined to a particular execution scope.
 */
export enum ExecutionScope {
  /**
   * A special execution scope, `app` has access to all other scopes. It's
   * long lived and will continue until execution of the application ends.
   */
  App = "app",
  /** A scope that only has access to a single pr during its execution */
  PullRequest = "pr",
}

export type PRContext = Context<WebhookPayloadPullRequest>;
export type Status = Pick<ReposCreateStatusParams, "state" | "description">;

type PRHookNames = keyof Hooks["pr"];

export interface Hooks {
  [ExecutionScope.App]: {
    onStart: SyncBailHook<[Application], Autobot>;
    onEnd: SyncHook<[]>;
  };
  [ExecutionScope.PullRequest]: {
    /** Allows a plugin to modify the config before it's used anywhere */
    modifyConfig: AsyncSeriesWaterfallHook<[Config]>;
    /**
     * If a plugin tapped into this method returns `true`, processing of the current
     * PR is ended early for all plugins. The plugin can then use `modifySkipStatus`
     * to update the GitHub status of the PR.
     */
    shouldSkipAllProcessing: AsyncParallelBailHook<[PRContext, Config], void | true>;
    /**
     * When processing is skipped, plugins have a change to alter the status that will
     * be reported on the PR. The default status state is `success` with no description.
     */
    modifySkipStatus: AsyncSeriesWaterfallHook<[Status, PRContext, Config]>;
    /**
     * Gives plugins an opportunity to do whatever it may need to do when PR processing
     * is skipped. This is called _after_ the skip status has been set.
     */
    onSkip: AsyncParallelHook<[PRContext, Config]>;
    /**
     * If the PR isn't skipped then we create a pending status. This hook allows plugins
     * to edit the status' message. Note that the status itself can't be changed from the
     * `pending` state.
     */
    modifyPendingStatusMessage: AsyncSeriesWaterfallHook<[string, PRContext, Config]>;
    /**
     * The meat and potatoes of the pr plugins. This is the plugin's time to do whatever it
     * needs to do to the PR.
     */
    process: AsyncSeriesHook<[PRContext, Config]>;
    /**
     * After all the plugins have processed the PR, there's a change to modify
     * the status being reported to GitHub. It defaults to `success` with no message.
     */
    modifyCompleteStatus: AsyncSeriesWaterfallHook<[Status, PRContext, Config]>;
    /**
     * Hook that's called if there's at any point in the hooks process. It provides
     * both the hook name, and the error that caused the failure so the hooks can
     * appropriately clean up.
     */
    onError: SyncHook<[PRHookNames, Error]>;
  };
}

export class Autobot {
  private readonly hooks: Hooks;
  private readonly plugins: UninitializedPlugin[];

  private constructor(plugins: UninitializedPlugin[]) {
    this.plugins = plugins;
    this.hooks = {
      [ExecutionScope.App]: {
        onStart: new SyncBailHook(["app"]),
        onEnd: new SyncHook(),
      },
      [ExecutionScope.PullRequest]: {
        modifyConfig: new AsyncSeriesWaterfallHook(["config"]),
        shouldSkipAllProcessing: new AsyncParallelBailHook(["context", "config"]),
        onSkip: new AsyncParallelHook(["context", "config"]),
        modifySkipStatus: new AsyncSeriesWaterfallHook(["status", "context", "config"]),
        modifyPendingStatusMessage: new AsyncSeriesWaterfallHook(["message", "context", "config"]),
        process: new AsyncSeriesHook(["context", "config"]),
        modifyCompleteStatus: new AsyncSeriesWaterfallHook(["status", "context", "config"]),
        onError: new SyncHook(["hookName", "error"]),
      },
    };
    this.initializePlugins(ExecutionScope.App);
  }

  private initializePlugins(scope: ExecutionScope, context?: PRContext) {
    const scopePluginInstances = <T extends Plugin>() =>
      this.plugins.filter(plugin => plugin.scope === scope).map(Plugin => new Plugin()) as T[];

    switch (scope) {
      case ExecutionScope.App:
        return scopePluginInstances<AppPlugin>().forEach(plugin => plugin.apply(this.hooks));
      case ExecutionScope.PullRequest:
        if (!context) throw new Error("PR Context must be provided to each initialized plugin");
        return scopePluginInstances<PullRequestPlugin>().forEach(plugin => plugin.apply(this.hooks.pr, context));
      default:
        throw new Error(`Attempting to intiailize plugins in unknown execution scope ${scope}`);
    }
  }

  private async getConfig(context: PRContext) {
    const config = await fetchConfig(context);
    return this.hooks.pr.modifyConfig.promise(config);
  }

  private setStatus(context: PRContext, status: Status) {
    const { sha } = context.payload.pull_request.head;
    return context.github.repos.createStatus({
      ...context.repo(),
      ...status,
      sha,
      context: "auto",
    });
  }

  // Start of the public API

  /**
   * Factory method used to create and start a new instance of `Autobot`
   * @param app The Probot app instance
   * @param plugins An array of uninstantiated `Plugin` classes
   */
  public static start(app: Application, plugins: UninitializedPlugin[]) {
    const autobot = new Autobot(plugins);
    autobot.hooks[ExecutionScope.App].onStart.call(app);
    return autobot;
  }

  public async onPullRequestReceived(context: PRContext) {
    this.initializePlugins(ExecutionScope.PullRequest, context);

    const [configError, config] = await to(this.getConfig(context));

    if (configError) {
      this.hooks.pr.onError.call("modifyConfig", configError);
      throw configError;
    }
    if (config === undefined || config === null) throw new Error("Config not defined");

    const [skipError, skip] = await to(this.hooks.pr.shouldSkipAllProcessing.promise(context, config));
    if (skipError) {
      this.hooks.pr.onError.call("shouldSkipAllProcessing", skipError);
      throw skipError;
    }

    if (skip) {
      const [errorModifySkipStatus, skipStatus] = await to(
        this.hooks.pr.modifySkipStatus.promise({ state: "success" }, context, config),
      );
      if (errorModifySkipStatus) {
        this.hooks.pr.onError.call("modifySkipStatus", errorModifySkipStatus);
        throw errorModifySkipStatus;
      }
      if (!skipStatus) throw new Error("Skip status isn't defined");

      const [setStatusError] = await to(this.setStatus(context, skipStatus));
      if (setStatusError) {
        this.hooks.pr.onError.call("onSkip", setStatusError);
        throw setStatusError;
      }

      const [onSkipError] = await to(this.hooks.pr.onSkip.promise(context, config));
      if (onSkipError) {
        this.hooks.pr.onError.call("onSkip", onSkipError);
        throw onSkipError;
      }
      return;
    }

    if (!this.hooks.pr.process.isUsed()) {
      logger.info("No plugins contain PR processing");
      return;
    }

    // Set pending status
    let pendingMessage: string | undefined = "Validating auto setup";
    let pendingMessageError;

    [pendingMessageError, pendingMessage] = await to(
      this.hooks.pr.modifyPendingStatusMessage.promise(pendingMessage, context, config),
    );

    if (pendingMessageError) {
      this.hooks.pr.onError.call("modifyPendingStatusMessage", pendingMessageError);
      throw pendingMessageError;
    }

    const [pendingStatusError] = await to(this.setStatus(context, { state: "pending", description: pendingMessage }));
    if (pendingStatusError) {
      this.hooks.pr.onError.call("modifyPendingStatusMessage", pendingStatusError);
      throw pendingStatusError;
    }

    const [processError] = await to(this.hooks.pr.process.promise(context, config));
    if (processError) {
      this.hooks.pr.onError.call("process", processError);
      throw processError;
    }

    // Set complete status
    const [completeStatusError, completeStatus] = await to(
      this.hooks.pr.modifyCompleteStatus.promise({ state: "success" }, context, config),
    );
    if (completeStatusError) {
      this.hooks.pr.onError.call("modifyCompleteStatus", completeStatusError);
      throw completeStatusError;
    }
    if (!completeStatus) throw new Error("Complete status not defined");

    const [setCompleteStatusError] = await to(this.setStatus(context, completeStatus));
    if (setCompleteStatusError) {
      this.hooks.pr.onError.call("modifyCompleteStatus", setCompleteStatusError);
      throw setCompleteStatusError;
    }
  }
}
