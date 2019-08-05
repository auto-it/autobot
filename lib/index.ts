import { WebHookEvent } from "./models/webhooks";
import { NowRequest, NowResponse } from "@now/node";
import { flatMap } from "lodash";
import { toLambda } from "probot-serverless-now";
import { OnCallback } from "probot/lib/application";
import { ClientRequest } from "http";
import { json } from "micro";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";

import ValidateLabelStatus from "./features/block-if-missing-labels";
import PROnboarding from "./features/pr-onboarding";
import { getLogger } from "./utils/logger";

const logger = getLogger("app");

interface FeatureListing {
  name: string;
  events: WebHookEvent[];
  handler: OnCallback<WebhookPayloadPullRequest>;
}

type FeatureCollection = FeatureListing[];

const features: FeatureCollection = [
  {
    name: "PR on-boarding",
    events: ["pull_request.opened", "pull_request.labeled", "pull_request.unlabeled", "pull_request.edited"],
    handler: PROnboarding,
  },
  {
    name: "Validate label status",
    events: ["pull_request.opened", "pull_request.labeled", "pull_request.unlabeled"],
    handler: ValidateLabelStatus,
  },
];

export = async (req: NowRequest, res: NowResponse) => {
  const events = flatMap(features, f => f.events);
  const topLevelEvents = events.map(e => e.split(".")[0]);

  const event = req.headers["x-github-event"];
  if (event && topLevelEvents.includes(event as string)) {
    // Prep cache
    global.cache = {};
    const { action, number } = (await json(req)) as any;
    logger.info(`--- PR #${number} ${event}.${action} --------------`);
    const relatedFeatures = features.filter(
      f => f.events.includes(event as WebHookEvent) || f.events.includes(`${event}.${action}` as WebHookEvent),
    );
    logger.debug("related features", relatedFeatures.length);
    return toLambda(app => {
      for (let feature of relatedFeatures) {
        app.on(feature.events, feature.handler);
      }
    })((req as unknown) as ClientRequest, res);
  } else {
    logger.debug("No matching header, skipping processing");
    res.status(200);
    res.end();
  }
};
