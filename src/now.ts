import { toLambda } from "probot-serverless-now";
import autobot from "./app";

export = toLambda(autobot as any);
