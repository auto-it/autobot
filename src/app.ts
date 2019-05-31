import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Autobot } from "./autobot";

import { BlockIfMissingLabels } from "./features/block-if-missing-labels";

const features = [BlockIfMissingLabels];

export = (app: Application) => {
  const autobot = Autobot.start(app, features);

  app.on("pull_request", async context => {
    await autobot.onPullRequestReceived(context);
  });
};
