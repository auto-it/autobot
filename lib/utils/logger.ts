import pino from "pino";

import { isProduction, isTest } from "./env";

export const rootLogger = pino({ base: {} });
export const getLogger = (namespace: string) => rootLogger.child({ namespace });

if (isProduction) {
  rootLogger.level = "info";
} else if (isTest) {
  rootLogger.level = "silent";
} else {
  rootLogger.level = "debug";
}
