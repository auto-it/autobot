import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { Context, Application } from "probot";

export type PRContext = Context<WebhookPayloadPullRequest>;

export const formattedRepoName = (context: PRContext) => {
  const { owner, repo } = context.repo();
  return `${owner}/${repo}`;
};

export const sentByThisApp = async (app: Application, context: PRContext): Promise<boolean> => {
  // We know it wasn't sent by the app if it's not sent by a bot
  if (!context.isBot) {
    return false;
  }

  const github = await app.auth();
  const { data: authedApp } = await github.apps.getAuthenticated();

  const { sender } = context.payload;

  // the html urls will both point the the app's landing page
  return authedApp.html_url === sender.html_url;
};
