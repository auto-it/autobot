import pino from "pino";

import { isProduction, isTest } from "./env";

let prettyPrint = !isProduction;

if (prettyPrint) {
  prettyPrint = require("pino-pretty");
}

export const rootLogger = pino({ base: {}, prettyPrint });
export const getLogger = (namespace: string) => rootLogger.child({ namespace });

if (isProduction) {
  rootLogger.level = "info";
} else if (isTest) {
  rootLogger.level = "silent";
} else {
  rootLogger.level = "debug";
}
