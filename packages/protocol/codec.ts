import { PROTOCOL_VERSION, WrapperMessageSchema, type WrapperMessage } from "./messages";

export type RawWireData = string | Buffer | ArrayBuffer | Uint8Array;
/** Hard cap before JSON parsing to bound CPU and memory per wire frame. */
export const MAX_WIRE_FRAME_BYTES = 128 * 1024;

/**
 * Decode and validate a single WrapperMessage from a wire payload.
 *
 * Returns `null` if the payload is unparseable JSON or fails schema validation.
 * Callers can decide how to react (drop, log, send `error` message).
 */
export function parseMessage(raw: RawWireData): WrapperMessage | null {
  if (wireByteLength(raw) > MAX_WIRE_FRAME_BYTES) return null;
  const text = toText(raw);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const result = WrapperMessageSchema.safeParse(json);
  return result.success ? result.data : null;
}

function wireByteLength(raw: RawWireData): number {
  if (typeof raw === "string") return new TextEncoder().encode(raw).byteLength;
  return raw.byteLength;
}

/**
 * Encode a WrapperMessage for the wire. Currently JSON; switching to a
 * binary codec only needs to change this single function.
 */
export function encodeMessage(msg: WrapperMessage): string {
  return JSON.stringify({ ...msg, protocolVersion: PROTOCOL_VERSION });
}

function toText(raw: RawWireData): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return new TextDecoder("utf-8").decode(raw);
}
