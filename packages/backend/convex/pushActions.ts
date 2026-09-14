"use node";

import { v } from "convex/values";
import { importPKCS8, SignJWT } from "jose";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const SESSION_TAG_LENGTH = 6;

type DeviceToken = {
  token: string;
  environment: "sandbox" | "production";
};

export const dispatchAttention = internalAction({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    kind: v.union(v.literal("bell"), v.literal("manual")),
  },
  handler: async (ctx, args): Promise<{ sent: number }> => {
    void args.kind;
    const tokens = (await ctx.runMutation(internal.push.listTokensForUser, {
      userId: args.userId,
    })) as DeviceToken[];
    if (tokens.length === 0) return { sent: 0 };
    const tag = args.sessionId.slice(0, SESSION_TAG_LENGTH);
    const body = `Session ${tag} needs you.`;
    const results = await Promise.all(
      tokens.map((device) =>
        sendApns({
          token: device.token,
          environment: device.environment,
          sessionId: args.sessionId,
          body,
        }),
      ),
    );
    return { sent: results.filter(Boolean).length };
  },
});

async function sendApns(input: {
  token: string;
  environment: "sandbox" | "production";
  sessionId: string;
  body: string;
}): Promise<boolean> {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const bundleId = process.env.APNS_BUNDLE_ID?.trim() || "sh.wrapper.mobile";
  const pem = process.env.APNS_KEY_P8?.trim();
  if (!keyId || !teamId || !pem) return false;

  let authorization: string;
  try {
    authorization = await signApnsJwt({ keyId, teamId, pem });
  } catch {
    return false;
  }

  const host =
    input.environment === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
  const response = await fetch(`https://${host}/3/device/${input.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${authorization}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-collapse-id": input.sessionId.slice(0, 64),
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: "Wrapper",
          body: input.body,
        },
        sound: "default",
        "thread-id": input.sessionId,
      },
      sessionId: input.sessionId,
    }),
  });
  return response.ok;
}

async function signApnsJwt(input: { keyId: string; teamId: string; pem: string }): Promise<string> {
  const normalized = input.pem.includes("BEGIN PRIVATE KEY")
    ? input.pem.replace(/\\n/g, "\n")
    : `-----BEGIN PRIVATE KEY-----\n${input.pem.replace(/\\n/g, "\n")}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(normalized, "ES256");
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: input.keyId })
    .setIssuedAt()
    .setIssuer(input.teamId)
    .setExpirationTime("50m")
    .sign(key);
}
