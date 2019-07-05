import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Autobot } from "./autobot";

import { BlockIfMissingLabels } from "./features/block-if-missing-labels";
import { CalculateReleaseByLabels } from "./features/calculate-release-by-labels";

const features = [CalculateReleaseByLabels, BlockIfMissingLabels];

export = (app: Application) => {
  app.on("pull_request", async context => {
    const autobot = Autobot.start(app, features);
    await autobot.onPullRequestReceived(context);
  });
};
