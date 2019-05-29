import pino from "pino";
export const rootLogger = pino();
export const getLogger = (namespace: string) => rootLogger.child({ namespace });

const { NODE_ENV: env } = process.env;

if (env === "production") {
  rootLogger.level = "info";
} else if (env === "development") {
  rootLogger.level = "debug";
} else {
  rootLogger.level = "silent";
}
