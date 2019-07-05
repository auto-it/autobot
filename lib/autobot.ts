import { SyncHook, AsyncSeriesWaterfallHook, AsyncSeriesHook, AsyncParallelHook, AsyncSeriesBailHook } from "tapable";
import { Application, Context } from "probot";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { fetchConfig, Config } from "./config";
import { Plugin, AppPlugin, PullRequestPlugin, UninstantiatedPlugin, PullRequestAction } from "./plugin";
import { ReposCreateStatusParams } from "@octokit/rest";
import to from "await-to-js";
import { getLogger } from "./utils/logger";
import { isProduction } from "./utils/env";
import { fromPairs } from "lodash";
import { Release } from "./models/release";

const logger = getLogger("autobot");
const STATUS_CONTEXT = isProduction ? "auto" : "auto-dev";

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
    onStart: SyncHook<[Application]>;
    onEnd: SyncHook<[]>;
  };
  [ExecutionScope.PullRequest]: {
    /** Allows a plugin to modify the config before it's used anywhere */
    modifyConfig: AsyncSeriesWaterfallHook<[Config]>;
    /**
     * If the PR isn't skipped then we create a pending status. This hook allows plugins
     * to edit the status' message. Note that the status itself can't be changed from the
     * `pending` state.
     */
    modifyPendingStatusMessage: AsyncSeriesWaterfallHook<[string, PRContext, Config]>;

    /**
     * The point at which the type of release is determined. This can be hooked into
     * to generate releases in ways other than by label.
     */
    calculateReleaseType: AsyncSeriesBailHook<[PRContext, Config], Release<any>>;

    /**
     * A hook that provides the release type to any subscribing plugins. It'll either
     * be a `ValidRelease` or `InvalidRelease`. See the release model for more details.
     */
    onReleaseType: AsyncParallelHook<[Release<any>]>;
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

interface UninitializedPlugin {
  initialized: false;
  name: string;
  plugin: UninstantiatedPlugin;
}
interface InitializedPlugin {
  initialized: true;
  name: string;
  plugin: Plugin;
}

interface PluginCollection {
  [pluginName: string]: UninitializedPlugin | InitializedPlugin;
}

export class Autobot {
  private readonly hooks: Hooks;
  private readonly plugins: PluginCollection;

  private constructor(plugins: UninstantiatedPlugin[]) {
    this.plugins = fromPairs(
      plugins.map(plugin => [
        plugin.name,
        {
          initialized: false,
          name: plugin.name,
          plugin,
        },
      ]),
    );

    this.hooks = {
      [ExecutionScope.App]: {
        onStart: new SyncHook(["app"]),
        onEnd: new SyncHook(),
      },
      [ExecutionScope.PullRequest]: {
        modifyConfig: new AsyncSeriesWaterfallHook(["config"]),
        modifyPendingStatusMessage: new AsyncSeriesWaterfallHook(["message", "context", "config"]),
        calculateReleaseType: new AsyncSeriesBailHook(["context", "config"]),
        onReleaseType: new AsyncParallelHook(["release"]),
        process: new AsyncSeriesHook(["context", "config"]),
        modifyCompleteStatus: new AsyncSeriesWaterfallHook(["status", "context", "config"]),
        onError: new SyncHook(["hookName", "error"]),
      },
    };
    this.initializePlugins(ExecutionScope.App);
  }

  private initializePlugins(scope: ExecutionScope, context?: PRContext) {
    const scopePluginInstances = <T extends Plugin>() =>
      Object.values(this.plugins)
        .filter((options): options is UninitializedPlugin => !options.initialized)
        .filter(({ plugin }) => plugin.scope === scope)
        .map(
          ({ name, plugin: Plugin }) =>
            ({
              initialized: true,
              plugin: new Plugin() as T,
              name,
            } as const),
        );

    switch (scope) {
      case ExecutionScope.App:
        const appPlugins = scopePluginInstances<AppPlugin>();
        logger.debug(`${appPlugins.length} ${scope} plugins initialized`);

        return appPlugins.forEach(meta => {
          meta.plugin.apply(this.hooks);
          this.plugins[meta.name] = meta;
        });

      case ExecutionScope.PullRequest:
        if (!context) throw new Error("PR Context must be provided to each initialized plugin");

        const prPlugins = scopePluginInstances<PullRequestPlugin>();
        logger.debug(`${prPlugins.length} ${scope} plugins initialized`);

        return prPlugins.forEach(meta => {
          if (
            meta.plugin.actions === "*" ||
            meta.plugin.actions.includes(context.payload.action as PullRequestAction)
          ) {
            meta.plugin.apply(this.hooks.pr, context);
            this.plugins[meta.name] = meta;
          }
        });

      default:
        throw new Error(`Attempting to initialize plugins in unknown execution scope ${scope}`);
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
      context: STATUS_CONTEXT,
    });
  }

  // Start of the public API

  /**
   * Factory method used to create and start a new instance of `Autobot`
   * @param app The Probot app instance
   * @param plugins An array of uninstantiated `Plugin` classes
   */
  public static start(app: Application, plugins: UninstantiatedPlugin[]) {
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

    const [calculateReleaseTypeError, releaseType] = await to(
      this.hooks.pr.calculateReleaseType.promise(context, config),
    );
    if (calculateReleaseTypeError) {
      this.hooks.pr.onError.call("calculateReleaseType", calculateReleaseTypeError);
      throw calculateReleaseTypeError;
    }
    if (!releaseType) throw new Error("calculateReleaseType failed to return a release");

    const [onReleaseTypeError] = await to(this.hooks.pr.onReleaseType.promise(releaseType));

    if (onReleaseTypeError) {
      this.hooks.pr.onError.call("onReleaseType", onReleaseTypeError);
      throw onReleaseTypeError;
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
