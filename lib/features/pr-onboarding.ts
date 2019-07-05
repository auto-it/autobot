import { PullRequestPlugin, PullRequestAction } from "../plugin";
import { Hooks } from "../autobot";
import { getLogger } from "../utils/logger";

const logger = getLogger("pr-onboarding");

export class PROnBoarding extends PullRequestPlugin {
  public name = "PROnBoarding";
  public actions = [
    PullRequestAction.opened,
    PullRequestAction.edited,
    PullRequestAction.labeled,
    PullRequestAction.unlabeled,
  ];

  public apply(prHooks: Hooks["pr"]) {
    logger.debug(`Applying hooks for ${this.name}`);
  }
}
