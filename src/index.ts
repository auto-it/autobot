import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { Autobot } from "./autobot";

import FailIfNoReleaseLabels from "./features/fail-if-no-release-labels";

const features = [new FailIfNoReleaseLabels()];

export = (app: Application) => {
  const autobot = Autobot.start(app, features);

  app.on("pull_request", async context => {
    autobot.onPullRequestReceived(context);
  });
};
