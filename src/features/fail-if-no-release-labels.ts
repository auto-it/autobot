import { Context } from "probot/lib/context";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { PullsCreateResponseLabelsItem as Label } from "@octokit/rest";
import { fromPairs } from "lodash";

interface AutoConfig {
  labels: {
    [labelKey: string]:
      | string
      | {
          name?: string;
          title: string;
          description: string;
          color?: string;
        };
  };
}

const getConfigLabelPairs = (labels: AutoConfig["labels"]): [string, string][] =>
  Object.entries(labels).map(([labelKey, label]) => [
    labelKey,
    typeof label === "string" ? label : label.name ? label.name : labelKey,
  ]);

export const failIfNoReleaseLabels = (context: Context<WebhookPayloadPullRequest>, config: AutoConfig) => {
  const prLabels: string[] = (context.payload.pull_request.labels as Label[]).map(label => label.name);
  const configLabels = fromPairs(getConfigLabelPairs(config.labels));

  // TODO: Add logic to find skip releases
  const skipReleases = [];

  const hasMajor = prLabels.includes(configLabels.major);
  const hasMinor = prLabels.includes(configLabels.minor);
  const hasPatch = prLabels.includes(configLabels.patch);

  if (!hasMajor && !hasMinor && !hasPatch && skipReleases.length === 0) {
    const {
      owner: { login: owner },
      name: repo,
    } = context.payload.repository;
    const { sha } = context.payload.pull_request.head;
    context.github.repos.createStatus({
      owner,
      repo,
      sha,
      state: "failure",
      context: "autobot",
      description: "Missing auto labels",
    });
  }
};
