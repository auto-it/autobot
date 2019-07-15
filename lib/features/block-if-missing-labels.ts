import { PRContext } from "../models/context";
import { Status } from "../models/status";
import { getLogger } from "../utils/logger";
import { formattedRepoName } from "../models/context";
import { LabelRelease, LabelError } from "./calculate-release-by-labels";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import { Context } from "probot";
import { setStatus } from "../models/status";
import { getConfig } from "../config";
import { getLabelRelease } from "../models/release";

const logger = getLogger("block-if-missing-labels");

export const buildStatusMessage = (context: PRContext, release: LabelRelease): Status => {
  if (!release) {
    throw new Error("Release type unknown when trying to set blocked label status");
  }
  if (release.kind === "invalid" && release.reason === LabelError.NoLabels) {
    logger.info(`${formattedRepoName(context)} PR #${context.payload.number} missing required version labels`, {
      url: context.url,
    });
    return {
      state: "pending",
      description: "Waiting for valid release labels",
    };
  } else if (release.kind === "invalid" && release.reason === LabelError.ConflictingLabels) {
    return {
      state: "error",
      description: "Conflicting version labels",
    };
  } else if (release.kind === "invalid") {
    throw new Error("Unknown invalid label state");
    // TODO: Should this set an error status?
  } else if (release.skip) {
    return {
      state: "success",
      description: `Skipping release for this ${release.type} version`,
    };
  } else {
    return {
      state: "success",
      description: `This PR will release a ${release.type} version`,
    };
  }
};

export default async (context: Context<WebhookPayloadPullRequest>) => {
  // Get Config
  const config = await getConfig(context);

  // Set pending status
  const pendingMessage = "Validating auto setup";

  await setStatus(context, { state: "pending", description: pendingMessage });

  // Get version
  const release = getLabelRelease(context, config);
  const statusMessage = buildStatusMessage(context, release);

  // Set complete status
  await setStatus(context, statusMessage);
};
