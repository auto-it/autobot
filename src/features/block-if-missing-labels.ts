import { PullsCreateResponseLabelsItem as Label } from "@octokit/rest";
import { fromPairs } from "lodash";
import { PullRequestPlugin } from "../plugin";
import { Config } from "../config";
import { Hooks, PRContext, Status } from "../autobot";
import { intersection } from "lodash";
import { getLogger } from "../utils/logger";
import { formattedRepoName } from "../utils/pr-context";

const logger = getLogger("block-if-missing-labels");

const getConfigLabelPairs = (labels: Config["labels"]): [string, string][] =>
  Object.entries(labels).map(([labelKey, label]) => [
    labelKey,
    typeof label === "string" ? label : label.name ? label.name : labelKey,
  ]);

export enum LabelError {
  NoLabels,
  ConflictingLabels,
}

export enum ReleaseType {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
}

interface ReleaseMode {
  type: ReleaseType;
  skip: boolean;
}

export class BlockIfMissingLabels extends PullRequestPlugin {
  public name = "BlockIfMissingLabels";
  private releaseState: ReleaseMode | LabelError = LabelError.NoLabels;

  public apply(prHooks: Hooks["pr"]) {
    logger.debug(`Applying hooks for ${this.name}`);
    prHooks.process.tapPromise(this.name, this.isMissingRequiredLabels.bind(this));
    prHooks.modifyCompleteStatus.tapPromise(this.name, this.setStatus.bind(this));
  }

  private async setStatus(_status: Status, context: PRContext): Promise<Status> {
    if (this.releaseState === LabelError.NoLabels) {
      logger.info(`${formattedRepoName(context)} PR #${context.payload.number} missing required version labels`, {
        url: context.url,
      });
      return {
        state: "pending",
        description: "Waiting for valid release labels",
      };
    } else if (this.releaseState === LabelError.ConflictingLabels) {
      return {
        state: "error",
        description: "Conflicting version labels",
      };
    } else if (this.releaseState.skip) {
      return {
        state: "success",
        description: `Skipping release for this ${this.releaseState.type} version`,
      };
    } else {
      return {
        state: "success",
        description: `This PR will release a ${this.releaseState.type} version`,
      };
    }
  }

  private async isMissingRequiredLabels(context: PRContext, config: Config) {
    const prLabels: string[] = (context.payload.pull_request.labels as Label[]).map(label => label.name);
    const configLabels = fromPairs(getConfigLabelPairs(config.labels));

    logger.debug({ prLabels, configLabels });

    const hasMajor = prLabels.includes(configLabels.major);
    const hasMinor = prLabels.includes(configLabels.minor);
    const hasPatch = prLabels.includes(configLabels.patch);

    const skipReleaseLabels = [config.labels["skip-release"], ...config.skipReleaseLabels];
    const hasSkipReleaseLabels = intersection(skipReleaseLabels, prLabels).length > 0;

    if (!hasMajor && !hasMinor && !hasPatch && !hasSkipReleaseLabels) {
      this.releaseState = LabelError.NoLabels;
    } else if ((hasMajor && hasMinor) || (hasMajor && hasPatch) || (hasMajor && hasPatch)) {
      this.releaseState = LabelError.ConflictingLabels;
    } else {
      this.releaseState = {
        type: (hasMajor && ReleaseType.Major) || (hasMinor && ReleaseType.Minor) || ReleaseType.Patch,
        skip: hasSkipReleaseLabels,
      };
    }
  }
}
