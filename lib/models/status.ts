import { PRContext } from "./context";
import { isProduction } from "../utils/env";
import { ReposCreateStatusParams } from "@octokit/rest";

const STATUS_CONTEXT = isProduction ? "auto" : "auto-dev";

export type Status = Pick<ReposCreateStatusParams, "state" | "description">;

export const setStatus = (context: PRContext, status: Status) => {
  const { sha } = context.payload.pull_request.head;
  return context.github.repos.createStatus({
    ...context.repo(),
    ...status,
    sha,
    context: STATUS_CONTEXT,
  });
};
