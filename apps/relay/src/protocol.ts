export type RawWireData = string | ArrayBuffer | Uint8Array;

type SessionId = string;

export type WrapperMessage =
  | { type: "attach"; sessionId: SessionId }
  | { type: "detach"; sessionId: SessionId }
  | { type: "input"; sessionId: SessionId; data: string }
  | { type: "resize"; sessionId: SessionId; size: { cols: number; rows: number } }
  | { type: "session.opened"; sessionId: SessionId; size: { cols: number; rows: number } }
  | { type: "session.closed"; sessionId: SessionId; exitCode: number | null }
  | { type: "output"; sessionId: SessionId; data: string }
  | {
      type: "error";
      sessionId?: SessionId;
      code: "bad_message" | "wrong_session" | "internal";
      message: string;
    };

export function encodeMessage(msg: WrapperMessage): string {
  return JSON.stringify(msg);
}

export function parseMessage(raw: RawWireData): WrapperMessage | null {
  const text = toText(raw);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isWrapperMessage(json)) return null;
  return json;
}

function toText(raw: RawWireData): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(raw));
  return new TextDecoder("utf-8").decode(raw);
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isSize(input: unknown): input is { cols: number; rows: number } {
  return (
    isObject(input) &&
    typeof input.cols === "number" &&
    Number.isFinite(input.cols) &&
    typeof input.rows === "number" &&
    Number.isFinite(input.rows)
  );
}

function isWrapperMessage(input: unknown): input is WrapperMessage {
  if (!isObject(input) || typeof input.type !== "string") return false;
  const { type } = input;

  if (type === "error") {
    return (
      (input.sessionId === undefined || typeof input.sessionId === "string") &&
      typeof input.code === "string" &&
      ["bad_message", "wrong_session", "internal"].includes(input.code) &&
      typeof input.message === "string"
    );
  }

  if (typeof input.sessionId !== "string") return false;

  switch (type) {
    case "attach":
    case "detach":
      return true;
    case "input":
    case "output":
      return typeof input.data === "string";
    case "resize":
      return isSize(input.size);
    case "session.opened":
      return isSize(input.size);
    case "session.closed":
      return input.exitCode === null || typeof input.exitCode === "number";
    default:
      return false;
  }
}
