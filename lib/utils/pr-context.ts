import { PRContext } from "../autobot";

export const formattedRepoName = (context: PRContext) => {
  const { owner, repo } = context.repo();
  return `${owner}/${repo}`;
};
