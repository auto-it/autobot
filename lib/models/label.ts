import { PRContext } from "./context";
import randomColor from "random-color";
import { get } from "../utils/get";
import { Octokit } from "probot";
import { Config } from "./config";
import { getLogger } from "../utils/logger";
import { hash } from "../utils/hash";
import { fromPairs } from "lodash";

const logger = getLogger("label");

const domain = "https://autobot.auto-it.now.sh";

export type Label = Octokit.PullsCreateResponseLabelsItem;

export const defaultLabelDefinition = {
  major: {
    name: "major",
    title: "💥  Breaking Change",
    description: "Increment the major version when merged",
  },
  minor: {
    name: "minor",
    title: "🚀  Enhancement",
    description: "Increment the minor version when merged",
  },
  patch: {
    name: "patch",
    title: "🐛  Bug Fix",
    description: "Increment the patch version when merged",
  },
  "skip-release": {
    name: "skip-release",
    description: "Preserve the current version when merged",
  },
  release: {
    name: "release",
    description: "Create a release when this pr is merged",
  },
  prerelease: {
    name: "prerelease",
    title: "🚧 Prerelease",
    description: "Create a pre-release version when merged",
  },
  internal: {
    name: "internal",
    title: "🏠  Internal",
    description: "Changes only affect the internal API",
  },
  documentation: {
    name: "documentation",
    title: "📝  Documentation",
    description: "Changes only affect the documentation",
  },
};

export const getLabelsFromConfig = (config: Config) => ({
  ...fromPairs(config.skipReleaseLabels.map(label => [label, label]) || []),
  ...fromPairs(
    Object.entries({ ...defaultLabelDefinition, ...config.labels }).map(([labelKey, label]) => [
      labelKey,
      typeof label === "string" ? label : label.name ? label.name : labelKey,
    ]),
  ),
});

export const getSkipReleaseLabelsFromConfig = (config: Config) =>
  [config.labels["skip-release"], ...config.skipReleaseLabels].filter(label => !!label);

export const getLabelsOnPR = (context: PRContext) => context.payload.pull_request.labels as Label[];

export const labelToString = (label: Label | LabelConfig, defaultName?: string) => {
  const labelText = typeof label === "string" ? label : label.name || defaultName;
  if (typeof labelText !== "string") throw new Error("Unable to convert label to string");
  return labelText;
};

export const addLabelsToPR = (context: PRContext, labels: string[]) => {
  const { owner, repo, number: issue_number } = context.issue();
  return context.github.issues.addLabels({ owner, repo, issue_number, labels });
};

export const removeLabelsFromPR = (context: PRContext, labels: string[]) => {
  const { owner, repo, number: issue_number } = context.issue();
  const prLabels = getLabelsOnPR(context).map(label => labelToString(label, ""));
  const labelsToRemove = labels.filter(label => prLabels.includes(label));
  return Promise.all(
    labelsToRemove.map(label => context.github.issues.removeLabel({ owner, repo, issue_number, name: label })),
  );
};

export const findLabelFromHash = (labelHash: string, config: Config) =>
  Object.values(getLabelsFromConfig(config)).find(label => hash(label) === labelHash);

export type LabelConfig =
  | string
  | {
      name?: string;
      title: string;
      description: string;
      color?: string;
    };

export interface NormalizedLabel {
  name: string;
  color: string;
  description?: string;
}

export const renderLabel = (label: NormalizedLabel) =>
  `<img align="center" src="${domain}/l/label?color=${label.color}&text=${label.name}"/> ${
    label.description ? `&nbsp;&nbsp;<sub><b>${label.description}</b></sub>}` : ""
  }`;

// TODO: Error handling, tests
export const populateLabel = async (
  labelType: string,
  label: LabelConfig,
  context: PRContext,
  labels: Octokit.IssuesListLabelsForRepoResponseItem[],
): Promise<NormalizedLabel> => {
  logger.debug("Populate label", label);
  const { owner, repo } = context.repo();
  const labelText = typeof label === "string" ? label : label.name || labelType;
  const labelAlreadyExists = labels.find(l => l.name === labelText);

  if (labelAlreadyExists) {
    const { name, description, color } = labelAlreadyExists;
    return { name, description, color };
  } else {
    const color = randomColor()
      .hexString()
      .substr(1);
    type DefaultLabelKey = keyof typeof defaultLabelDefinition;
    const description =
      (typeof label !== "string" && !!label.description && label.description) ||
      get(defaultLabelDefinition, d => d[labelType as DefaultLabelKey].description, "");
    await context.github.issues.createLabel({ owner, repo, name: labelText, color, description });
    return { name: labelText, description, color };
  }
};
