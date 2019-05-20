import pino from "pino";
export const logger = pino();

const { NODE_ENV: env } = process.env;

if (env === "production") {
  logger.level = "info";
} else if (env === "development") {
  logger.level = "debug";
} else {
  logger.level = "silent";
}
