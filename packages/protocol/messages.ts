import { z } from "zod";
import { SessionIdSchema, TerminalSizeSchema } from "./session";

/**
 * Wire protocol between Wrapper CLI host (PTY owner) and connected clients
 * (local `wrapper attach`, mobile app, or future relay-routed mobile).
 *
 * Direction conventions:
 *   - "client -> server" means a connected client sends to the CLI host.
 *   - "server -> client" means the CLI host broadcasts to clients.
 *
 * All messages are JSON-encoded for now. Binary frame migration (e.g. MsgPack)
 * is intentionally deferred until profiling shows JSON overhead matters.
 */

// ────────────────────────────────────────────────────────────────────────────
// client -> server
// ────────────────────────────────────────────────────────────────────────────

export const AttachMessageSchema = z.object({
  type: z.literal("attach"),
  sessionId: SessionIdSchema,
});
export type AttachMessage = z.infer<typeof AttachMessageSchema>;

export const DetachMessageSchema = z.object({
  type: z.literal("detach"),
  sessionId: SessionIdSchema,
});
export type DetachMessage = z.infer<typeof DetachMessageSchema>;

export const InputMessageSchema = z.object({
  type: z.literal("input"),
  sessionId: SessionIdSchema,
  data: z.string(),
});
export type InputMessage = z.infer<typeof InputMessageSchema>;

export const ResizeMessageSchema = z.object({
  type: z.literal("resize"),
  sessionId: SessionIdSchema,
  size: TerminalSizeSchema,
});
export type ResizeMessage = z.infer<typeof ResizeMessageSchema>;

// ────────────────────────────────────────────────────────────────────────────
// server -> client
// ────────────────────────────────────────────────────────────────────────────

export const SessionOpenedMessageSchema = z.object({
  type: z.literal("session.opened"),
  sessionId: SessionIdSchema,
  size: TerminalSizeSchema,
});
export type SessionOpenedMessage = z.infer<typeof SessionOpenedMessageSchema>;

export const SessionClosedMessageSchema = z.object({
  type: z.literal("session.closed"),
  sessionId: SessionIdSchema,
  exitCode: z.number().int().nullable(),
});
export type SessionClosedMessage = z.infer<typeof SessionClosedMessageSchema>;

export const OutputMessageSchema = z.object({
  type: z.literal("output"),
  sessionId: SessionIdSchema,
  data: z.string(),
});
export type OutputMessage = z.infer<typeof OutputMessageSchema>;

export const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  sessionId: SessionIdSchema.optional(),
  code: z.enum(["bad_message", "wrong_session", "internal"]),
  message: z.string(),
});
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

// ────────────────────────────────────────────────────────────────────────────
// WebRTC signaling (relayed both directions)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Opaque WebRTC signaling frame relayed between a host and a specific viewer to
 * negotiate a direct P2P data channel (the low-latency fast path; the relay
 * remains the fallback).
 *
 * Routing/security: `viewer -> host` addresses `to: "host"`; `host -> viewer`
 * addresses `to: <viewer peerId>`. The relay is authoritative for peer identity
 * (it stamps `from` with the connection's assigned peerId, ignoring any client
 * claim) and only routes within a single session, so viewers can neither spoof
 * another peer nor reach a different session. `data` is capped to bound memory.
 */
export const SignalMessageSchema = z.object({
  type: z.literal("signal"),
  sessionId: SessionIdSchema,
  to: z.string().min(1).max(128),
  from: z.string().min(1).max(128),
  kind: z.enum(["offer", "answer", "ice", "bye"]),
  data: z.string().max(64 * 1024),
});
export type SignalMessage = z.infer<typeof SignalMessageSchema>;

// ────────────────────────────────────────────────────────────────────────────
// discriminated union
// ────────────────────────────────────────────────────────────────────────────

export const WrapperMessageSchema = z.discriminatedUnion("type", [
  AttachMessageSchema,
  DetachMessageSchema,
  InputMessageSchema,
  ResizeMessageSchema,
  SessionOpenedMessageSchema,
  SessionClosedMessageSchema,
  OutputMessageSchema,
  ErrorMessageSchema,
  SignalMessageSchema,
]);
export type WrapperMessage = z.infer<typeof WrapperMessageSchema>;
