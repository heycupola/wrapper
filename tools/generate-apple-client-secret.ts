import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const teamId = required("APPLE_TEAM_ID");
const clientId = required("APPLE_CLIENT_ID");
const keyId = required("APPLE_KEY_ID");
const privateKeyPath = required("APPLE_PRIVATE_KEY_PATH");
const lifetimeDays = Number.parseInt(process.env.APPLE_SECRET_LIFETIME_DAYS ?? "180", 10);

if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 180) {
  throw new Error("APPLE_SECRET_LIFETIME_DAYS must be an integer from 1 through 180");
}

const now = Math.floor(Date.now() / 1_000);
const header = encode({ alg: "ES256", kid: keyId, typ: "JWT" });
const payload = encode({
  aud: "https://appleid.apple.com",
  exp: now + lifetimeDays * 24 * 60 * 60,
  iat: now,
  iss: teamId,
  sub: clientId,
});
const unsignedToken = `${header}.${payload}`;
const privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
const signature = sign("sha256", Buffer.from(unsignedToken), {
  dsaEncoding: "ieee-p1363",
  key: privateKey,
}).toString("base64url");

process.stdout.write(`${unsignedToken}.${signature}\n`);

function encode(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
