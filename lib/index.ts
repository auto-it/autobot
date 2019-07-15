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

export const initialize = async (req: NowRequest, res: NowResponse) => {
  const events = flatMap(features, f => f.events);
  const topLevelEvents = events.map(e => e.split(".")[0]);

  const event = req.headers["X-GitHub-Event"];
  if (event && topLevelEvents.includes(event as string)) {
    const { action } = (await json(req)) as any;
    const relatedFeatures = features.filter(
      f => f.events.includes(event as WebHookEvent) || f.events.includes(`${event}.${action}` as WebHookEvent),
    );
    return toLambda(app => {
      for (let feature of relatedFeatures) {
        app.on(feature.events, feature.handler);
      }
    })((req as unknown) as ClientRequest, res);
  } else {
    res.status(200);
    res.end();
  }
};
