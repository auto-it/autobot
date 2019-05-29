import pino from "pino";

const { NODE_ENV: env } = process.env;

const isProduction = env === "production";
let prettyPrint = !isProduction;

if (prettyPrint) {
  prettyPrint = require("pino-pretty");
}

export const rootLogger = pino({ base: {}, prettyPrint });
export const getLogger = (namespace: string) => rootLogger.child({ namespace });

if (isProduction) {
  rootLogger.level = "info";
} else {
  rootLogger.level = "debug";
}
