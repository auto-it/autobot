import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Context } from "probot/lib/context";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";

const fetchConfig = async (context: Context<WebhookPayloadPullRequest>) => {
  const contentArgs = context.repo({ path: ".autorc", ref: context.payload.pull_request.head.ref });
  const { data } = await context.github.repos.getContents(contentArgs);
  return new Buffer(data.content, "base64").toString();
};

export = (app: Application) => {
  app.on("pull_request.opened", async context => {
    app.log(context.payload.pull_request.labels);
    const config = await fetchConfig(context);
    app.log(config);
  });

  app.on("issues.opened", async context => {
    const issueComment = context.issue({ body: "Thanks for opening this issue!" });
    await context.github.issues.createComment(issueComment);
  });
  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
