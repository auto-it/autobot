import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Autobot } from "./autobot";

import { BlockIfMissingLabels } from "./features/block-if-missing-labels";
import { CalculateReleaseByLabels } from "./features/calculate-release-by-labels";

const features = [CalculateReleaseByLabels, BlockIfMissingLabels];

export = (app: Application) => {
  const autobot = Autobot.start(app, features);

  app.on("pull_request", async context => {
    await autobot.onPullRequestReceived(context);
  });
};
