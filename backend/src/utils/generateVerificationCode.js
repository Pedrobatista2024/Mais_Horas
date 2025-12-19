import crypto from "crypto";

export const generateVerificationCode = () => {
  return crypto.randomBytes(8).toString("hex");
};
