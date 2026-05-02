import { WrapperMessageSchema, type WrapperMessage } from "./messages";

export type RawWireData = string | Buffer | ArrayBuffer | Uint8Array;

/**
 * Decode and validate a single WrapperMessage from a wire payload.
 *
 * Returns `null` if the payload is unparseable JSON or fails schema validation.
 * Callers can decide how to react (drop, log, send `error` message).
 */
export function parseMessage(raw: RawWireData): WrapperMessage | null {
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

/**
 * Encode a WrapperMessage for the wire. Currently JSON; switching to a
 * binary codec only needs to change this single function.
 */
export function encodeMessage(msg: WrapperMessage): string {
  return JSON.stringify(msg);
}

function toText(raw: RawWireData): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return new TextDecoder("utf-8").decode(raw);
}
