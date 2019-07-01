const { NODE_ENV: env } = process.env;

export const isProduction = env === "production";
export const isTest = env === "test";
