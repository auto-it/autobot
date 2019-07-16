import { PRContext } from "./context";
import { Config } from "./config";
import { getLabelsOnPR, labelToString, getSkipReleaseLabelsFromConfig } from "./label";
import { fromPairs, intersection } from "lodash";
import { getLogger } from "../utils/logger";

const logger = getLogger("release");

export enum ReleaseType {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
}

export interface ValidRelease {
  kind: "valid";
  type: ReleaseType;
  skip: boolean;
}

export const validRelease = ({ type, skip }: { type: ReleaseType; skip: boolean }): ValidRelease => ({
  kind: "valid",
  type,
  skip,
});

export interface InvalidRelease<R> {
  kind: "invalid";
  reason: R;
}

export const invalidRelease = <R>(reason: R): InvalidRelease<R> => ({
  kind: "invalid",
  reason,
});

export type Release<R> = ValidRelease | InvalidRelease<R>;

export type LabelRelease = Release<LabelError>;

export enum LabelError {
  NoLabels,
  ConflictingLabels,
}

const getConfigLabelPairs = (labels: Config["labels"]): [string, string][] =>
  Object.entries(labels).map(([labelKey, label]) => [
    labelKey,
    typeof label === "string" ? label : label.name ? label.name : labelKey,
  ]);

export const calculateLabelRelease = (context: PRContext, config: Config) => {
  let release: Release<LabelError>;

  logger.debug("labels", { labels: context.payload.pull_request.labels });

  const prLabels: string[] = getLabelsOnPR(context).map(l => labelToString(l, ""));
  const configLabels = fromPairs(getConfigLabelPairs(config.labels));

  logger.debug("prLabels", { prLabels });
  logger.debug("configLabels", configLabels);

  const hasMajor = prLabels.includes(configLabels.major);
  const hasMinor = prLabels.includes(configLabels.minor);
  const hasPatch = prLabels.includes(configLabels.patch);

  const skipReleaseLabels: string[] = getSkipReleaseLabelsFromConfig(config).map(l => labelToString(l, "skip-release"));
  const hasSkipReleaseLabels = intersection(skipReleaseLabels, prLabels).length > 0;

  if (!hasMajor && !hasMinor && !hasPatch && !hasSkipReleaseLabels) {
    release = invalidRelease(LabelError.NoLabels);
  } else if ((hasMajor && hasMinor) || (hasMajor && hasPatch) || (hasMajor && hasPatch)) {
    release = invalidRelease(LabelError.ConflictingLabels);
  } else {
    release = validRelease({
      type: (hasMajor && ReleaseType.Major) || (hasMinor && ReleaseType.Minor) || ReleaseType.Patch,
      skip: hasSkipReleaseLabels,
    });
  }

  return release;
};

let labelRelease: LabelRelease;
export const getLabelRelease = (context: PRContext, config: Config) => {
  if (!labelRelease) {
    labelRelease = calculateLabelRelease(context, config);
  }
  return labelRelease;
};
