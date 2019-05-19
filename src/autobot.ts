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

export interface Hooks {
  [ExecutionScope.App]: {
    onStart: SyncBailHook<[Application], Autobot>;
    onEnd: SyncHook<[]>;
  };
  [ExecutionScope.PullRequest]: {
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
      },
    };
    this.initializePlugins(ExecutionScope.App);
  }

  private initializePlugins(scope: ExecutionScope) {
    const scopePluginInstances = <T extends Plugin>() =>
      this.plugins.filter(plugin => plugin.scope === scope).map(Plugin => new Plugin()) as T[];

    switch (scope) {
      case ExecutionScope.App:
        return scopePluginInstances<AppPlugin>().forEach(plugin => plugin.apply(this.hooks));
      case ExecutionScope.PullRequest:
        return scopePluginInstances<PullRequestPlugin>().forEach(plugin => plugin.apply(this.hooks.pr));
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

  public static start(app: Application, plugins: UninitializedPlugin[]) {
    const autobot = new Autobot(plugins);
    autobot.hooks[ExecutionScope.App].onStart.call(app);
    return autobot;
  }

  public async onPullRequestReceived(context: PRContext) {
    this.initializePlugins(ExecutionScope.PullRequest);
    const config = await this.getConfig(context);
    const skip = await this.hooks.pr.shouldSkipAllProcessing.promise(context, config);

    if (skip) {
      const status = await this.hooks.pr.modifySkipStatus.promise({ state: "success" }, context, config);
      await this.setStatus(context, status);
      await this.hooks.pr.onSkip.promise(context, config);
      return;
    }

    // Set pending status
    let pendingMessage = "Validating auto setup";
    pendingMessage = await this.hooks.pr.modifyPendingStatusMessage.promise(pendingMessage, context, config);
    this.setStatus(context, { state: "pending", description: pendingMessage });

    await this.hooks.pr.process.promise(context, config);

    // Set complete status
    const completeStatus = await this.hooks.pr.modifyCompleteStatus.promise({ state: "success" }, context, config);
    this.setStatus(context, completeStatus);
  }
}
