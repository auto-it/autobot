import { PullRequestPlugin } from "../plugin";
import { Hooks, PRContext } from "../autobot";
import { Config } from "../config";
import { Release, ReleaseType, invalidRelease, validRelease } from "../models/release";
import { getLogger } from "../utils/logger";
import { fromPairs, intersection } from "lodash";
import { PullsCreateResponseLabelsItem as Label } from "@octokit/rest";

const logger = getLogger("block-if-missing-labels");

const getConfigLabelPairs = (labels: Config["labels"]): [string, string][] =>
  Object.entries(labels).map(([labelKey, label]) => [
    labelKey,
    typeof label === "string" ? label : label.name ? label.name : labelKey,
  ]);

export type LabelRelease = Release<LabelError>;

export enum LabelError {
  NoLabels,
  ConflictingLabels,
}

export class CalculateReleaseByLabels extends PullRequestPlugin {
  public name = "CalculateReleaseByLabel";

  public apply(prHooks: Hooks["pr"]) {
    prHooks.calculateReleaseType.tapPromise(this.name, this.calculateRelease);
  }

  private calculateRelease = async (context: PRContext, config: Config) => {
    let release: Release<LabelError>;

    const prLabels: string[] = (context.payload.pull_request.labels as Label[]).map(label => label.name);
    const configLabels = fromPairs(getConfigLabelPairs(config.labels));

    logger.debug({ prLabels, configLabels });

    const hasMajor = prLabels.includes(configLabels.major);
    const hasMinor = prLabels.includes(configLabels.minor);
    const hasPatch = prLabels.includes(configLabels.patch);

    const skipReleaseLabels = [config.labels["skip-release"], ...config.skipReleaseLabels];
    const hasSkipReleaseLabels = intersection(skipReleaseLabels, prLabels).length > 0;

    if (!hasMajor && !hasMinor && !hasPatch && !hasSkipReleaseLabels) {
      release = invalidRelease(LabelError.NoLabels);
    } else if ((hasMajor && hasMinor) || (hasMajor && hasPatch) || (hasMajor && hasPatch)) {
      release = invalidRelease(LabelError.ConflictingLabels);
    } else {
      release = validRelease({
        type: (hasMajor && ReleaseType.Major) || (hasMinor && ReleaseType.Minor) || ReleaseType.Patch,
        skip: hasSkipReleaseLabels,
      });
    }

    return release;
  };
}
