import { PullRequestPlugin } from "../plugin";
import { Hooks, PRContext, Status } from "../autobot";
import { getLogger } from "../utils/logger";
import { formattedRepoName } from "../models/pr-context";
import { LabelRelease, LabelError } from "./calculate-release-by-labels";

const logger = getLogger("block-if-missing-labels");

export class BlockIfMissingLabels extends PullRequestPlugin {
  public name = "BlockIfMissingLabels";
  private release?: LabelRelease;

  public apply(prHooks: Hooks["pr"]) {
    logger.debug(`Applying hooks for ${this.name}`);
    prHooks.onReleaseType.tap(this.name, release => (this.release = release));
    prHooks.modifyCompleteStatus.tapPromise(this.name, this.setStatus.bind(this));
  }

  private setStatus = async (_status: Status, context: PRContext): Promise<Status> => {
    if (!this.release) {
      throw new Error("Release type unknown when trying to set blocked label status");
    }
    if (this.release.kind === "invalid" && this.release.reason === LabelError.NoLabels) {
      logger.info(`${formattedRepoName(context)} PR #${context.payload.number} missing required version labels`, {
        url: context.url,
      });
      return {
        state: "pending",
        description: "Waiting for valid release labels",
      };
    } else if (this.release.kind === "invalid" && this.release.reason === LabelError.ConflictingLabels) {
      return {
        state: "error",
        description: "Conflicting version labels",
      };
    } else if (this.release.kind === "invalid") {
      throw new Error("Unknown invalid label state");
      // TODO: Should this set an error status?
    } else if (this.release.skip) {
      return {
        state: "success",
        description: `Skipping release for this ${this.release.type} version`,
      };
    } else {
      return {
        state: "success",
        description: `This PR will release a ${this.release.type} version`,
      };
    }
  };
}
