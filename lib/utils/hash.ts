import crypto from "crypto";

export const hash = (text: string) =>
  crypto
    .createHash("md5")
    .update(text)
    .digest("hex");
