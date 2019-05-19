import { ExecutionScope, Hooks } from "./autobot";

/**
 * Do not directly extend from this class
 */
export abstract class Plugin {
  abstract name: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public apply(...args: any[]) {
    throw new Error(`Plugin ${this.name} must have an apply method`);
  }
}

export abstract class AppPlugin extends Plugin {
  public static scope = ExecutionScope.App;
  abstract apply(hooks: Hooks): void;
}

export abstract class PullRequestPlugin extends Plugin {
  public static scope = ExecutionScope.PullRequest;
  abstract apply(hooks: Hooks[ExecutionScope.PullRequest]): void;
}

export type UninitializedPlugin = typeof AppPlugin | typeof PullRequestPlugin;
