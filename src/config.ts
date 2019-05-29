import { Context } from "probot/lib/context";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import merge from "deepmerge";
import axios from "axios";
import { property, isPlainObject } from "lodash";
import { defaultLabelDefinition } from "auto/dist/release";
import { getLogger } from "./utils/logger";

const logger = getLogger("config");

type LabelConfig =
  | string
  | {
      name?: string;
      title: string;
      description: string;
      color?: string;
    };

export interface Config {
  labels: {
    [labelKey: string]: LabelConfig;
  };
  skipReleaseLabels: LabelConfig[];
}

export const fetchExtendedURLConfig = async (extendedConfig: string) => {
  try {
    const { data } = await axios.get(extendedConfig);
    if (!isPlainObject(data)) {
      return JSON.parse(data);
    }
    return data;
  } catch {
    throw new Error(
      `Failed to get extended config from ${extendedConfig}. Check the URL and ensure the endpoint has a JSON response.`,
    );
  }
};

export const fetchExtendedRelativeConfig = async (
  context: Context<WebhookPayloadPullRequest>,
  extendedConfig: string,
) => {
  const repoContext = context.repo({ path: extendedConfig });
  let config = {};
  try {
    const { data } = await context.github.repos.getContents(repoContext);
    config = JSON.parse(Buffer.from(data.content, "base64").toString());
  } catch (error) {
    const { owner, repo, path } = repoContext;
    error.message = `Can't fetch config from https://github.com/${owner}/${repo}/${path} -- ${error.message}`;
    throw error;
  }
  return config;
};

export const fetchExtendedScopedModuleConfig = async (extendedConfig: string) => {
  const unpkgURL = `https://unpkg.com/${extendedConfig}/auto-config@latest/package.json`;
  const { data } = await axios.get(unpkgURL);
  return data.auto;
};

export const fetchExtendedModuleConfig = async (extendedConfig: string) => {
  const unpkgURL = `https://unpkg.com/auto-config-${extendedConfig}@latest/package.json`;
  const { data } = await axios.get(unpkgURL);
  return data.auto;
};

const fetchExtendedConfig = async (context: Context<WebhookPayloadPullRequest>, extendedConfig: string) => {
  const { owner, repo } = context.repo();
  logger.debug(`Found extended config`);
  switch (true) {
    case extendedConfig.startsWith("http"):
      logger.debug(`Downloading extended config from ${extendedConfig}`);
      return await fetchExtendedURLConfig(extendedConfig);
    case extendedConfig.startsWith("."):
      logger.debug(`Looking for extended config in ${owner}/${repo} at ${extendedConfig}`);
      return await fetchExtendedRelativeConfig(context, extendedConfig);
    case extendedConfig.startsWith("@"):
      logger.debug(`Looking for extended config in module ${extendedConfig}/auto-config`);
      return await fetchExtendedScopedModuleConfig(extendedConfig);
    default:
      logger.debug(`Looking for extended config in module auto-config-${extendedConfig}`);
      return await fetchExtendedModuleConfig(extendedConfig);
  }
};

/**
 *
 * @param context The context of the PR being represented
 * @param path A sub-path of the json result to access (i.e. "config.auto")
 */
export const fetchConfig = async (context: Context<WebhookPayloadPullRequest>, path = "") => {
  // Download config from GitHub
  const contentArgs = context.repo({ path: ".autorc", ref: context.payload.pull_request.head.ref });
  const { data } = await context.github.repos.getContents(contentArgs);
  let config = JSON.parse(Buffer.from(data.content, "base64").toString());

  // Fetch extended config
  if (config.extends) {
    let extendedConfig = await fetchExtendedConfig(context, config.extends);
    logger.debug(extendedConfig);
    if (path) {
      extendedConfig = property(path)(extendedConfig);
    }
    logger.debug(extendedConfig);
    config = merge(config, extendedConfig);
    delete config.extends;
    logger.debug(extendedConfig);
  }

  // Set defaults
  config = merge({ labels: defaultLabelDefinition }, config);
  return config;
};
