import { PullsCreateResponseLabelsItem as Label } from "@octokit/rest";
import { fromPairs } from "lodash";
import { PullRequestPlugin } from "../plugin";
import { Config } from "../config";
import { Hooks, PRContext, Status } from "../autobot";
import { intersection } from "lodash";

const getConfigLabelPairs = (labels: Config["labels"]): [string, string][] =>
  Object.entries(labels).map(([labelKey, label]) => [
    labelKey,
    typeof label === "string" ? label : label.name ? label.name : labelKey,
  ]);

export default class FailIfMissingLabels extends PullRequestPlugin {
  public name = "FailIfNoReleaseLabels";
  private failed = false;

  public apply(prHooks: Hooks["pr"]) {
    prHooks.shouldSkipAllProcessing.tapPromise(this.name, this.isMissingRequiredLabels.bind(this));
    prHooks.modifySkipStatus.tapPromise(this.name, this.setSkipStatus.bind(this));
  }

  private async setSkipStatus(status: Status): Promise<Status> {
    return this.failed
      ? {
          state: "failure",
          description: "Missing version or skip-release labels",
        }
      : status;
  }

  private async isMissingRequiredLabels(context: PRContext, config: Config) {
    const prLabels: string[] = (context.payload.pull_request.labels as Label[]).map(label => label.name);
    const configLabels = fromPairs(getConfigLabelPairs(config.labels));

    const hasMajor = prLabels.includes(configLabels.major);
    const hasMinor = prLabels.includes(configLabels.minor);
    const hasPatch = prLabels.includes(configLabels.patch);

    const skipReleaseLabels = [config.labels["skip-release"], ...config.skipReleaseLabels];
    const hasSkipReleaseLabels = intersection(skipReleaseLabels, prLabels).length > 0;

    if (!hasMajor && !hasMinor && !hasPatch && !hasSkipReleaseLabels) {
      this.failed = true;
      return true;
    }
    return;
  }
}
