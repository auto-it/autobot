import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { Context } from "probot";

export type PRContext = Context<WebhookPayloadPullRequest>;

export const formattedRepoName = (context: PRContext) => {
  const { owner, repo } = context.repo();
  return `${owner}/${repo}`;
};
