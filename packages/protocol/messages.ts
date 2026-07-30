import { z } from "zod";
import { SessionIdSchema, TerminalSizeSchema } from "./session";

/** Maximum terminal payload carried by one input/output protocol frame. */
export const MAX_TERMINAL_DATA_LENGTH = 64 * 1024;
/** Maximum human-readable protocol error detail. */
export const MAX_ERROR_MESSAGE_LENGTH = 1024;
/** Current backwards-compatible JSON wire version. */
export const PROTOCOL_VERSION = 1 as const;
const ProtocolVersionSchema = z.literal(PROTOCOL_VERSION).optional();

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
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("attach"),
  sessionId: SessionIdSchema,
});
export type AttachMessage = z.infer<typeof AttachMessageSchema>;

export const DetachMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("detach"),
  sessionId: SessionIdSchema,
});
export type DetachMessage = z.infer<typeof DetachMessageSchema>;

export const InputMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("input"),
  sessionId: SessionIdSchema,
  data: z.string().max(MAX_TERMINAL_DATA_LENGTH),
});
export type InputMessage = z.infer<typeof InputMessageSchema>;

export const ResizeMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("resize"),
  sessionId: SessionIdSchema,
  size: TerminalSizeSchema,
});
export type ResizeMessage = z.infer<typeof ResizeMessageSchema>;

// ────────────────────────────────────────────────────────────────────────────
// server -> client
// ────────────────────────────────────────────────────────────────────────────

export const SessionOpenedMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("session.opened"),
  sessionId: SessionIdSchema,
  size: TerminalSizeSchema,
});
export type SessionOpenedMessage = z.infer<typeof SessionOpenedMessageSchema>;

export const SessionClosedMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("session.closed"),
  sessionId: SessionIdSchema,
  exitCode: z.number().int().nullable(),
});
export type SessionClosedMessage = z.infer<typeof SessionClosedMessageSchema>;

export const OutputMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("output"),
  sessionId: SessionIdSchema,
  data: z.string().max(MAX_TERMINAL_DATA_LENGTH),
});
export type OutputMessage = z.infer<typeof OutputMessageSchema>;

export const ErrorMessageSchema = z.object({
  protocolVersion: ProtocolVersionSchema,
  type: z.literal("error"),
  sessionId: SessionIdSchema.optional(),
  code: z.enum(["bad_message", "wrong_session", "internal"]),
  message: z.string().max(MAX_ERROR_MESSAGE_LENGTH),
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
  protocolVersion: ProtocolVersionSchema,
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
