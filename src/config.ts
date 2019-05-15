import { Context } from "probot/lib/context";
import { WebhookPayloadPullRequest } from "@octokit/webhooks";
import merge from "deepmerge";
import axios from "axios";
import { property, isPlainObject } from "lodash";
import { defaultLabelDefinition } from "auto/dist/release";

export const fetchExtendedURLConfig = async (extendedConfig: string) => {
  try {
    const { data } = await axios.get(extendedConfig, {
      headers: { "Content-Type": "application/json" },
    });
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
  const { data } = await axios.get(unpkgURL, { headers: "application/json" });
  return data.auto;
};

export const fetchExtendedModuleConfig = async (extendedConfig: string) => {
  const unpkgURL = `https://unpkg.com/auto-config-${extendedConfig}@latest/package.json`;
  const { data } = await axios.get(unpkgURL, { headers: "application/json" });
  return data.auto;
};

const fetchExtendedConfig = async (context: Context<WebhookPayloadPullRequest>, extendedConfig: string) => {
  switch (true) {
    case extendedConfig.startsWith("http"):
      return await fetchExtendedURLConfig(extendedConfig);
    case extendedConfig.startsWith("."):
      return await fetchExtendedRelativeConfig(context, extendedConfig);
    case extendedConfig.startsWith("@"):
      return await fetchExtendedScopedModuleConfig(extendedConfig);
    default:
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
    if (path) {
      extendedConfig = property(path)(extendedConfig);
    }
    config = merge(config, extendedConfig);
    delete config.extends;
  }

  // Set defaults
  config = merge({ labels: defaultLabelDefinition }, config);
  return config;
};
