import { Application } from "probot"; // eslint-disable-line no-unused-vars
import { fetchConfig } from "./config";

export = (app: Application) => {
  app.on("pull_request.opened", async context => {
    app.log("pull request received");
    app.log(context.payload.pull_request.labels);
    const config = await fetchConfig(context, "auto");
    app.log(config);
  });
};
