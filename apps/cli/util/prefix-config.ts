import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "@repo/logger";
import { paths } from "./paths";

const log = createLogger("prefix-config");

export const DEFAULT_PREFIX_BYTE = 0x1c; // Ctrl+\
const BLOCKED_PREFIX_BYTES = new Set([0x03, 0x04, 0x09, 0x0a, 0x0d, 0x1a, 0x1b]);

export type PrefixSource = "env" | "config" | "default";

export type ResolvedPrefix = {
  byte: number;
  label: string;
  source: PrefixSource;
};

type WrapperFileConfig = {
  prefix?: string;
};

export function isAllowedPrefixByte(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 31 && !BLOCKED_PREFIX_BYTES.has(value);
}

export function parsePrefix(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const hex = /^0x([0-9a-f]{1,2})$/i.exec(value);
  if (hex?.[1]) {
    const parsed = Number.parseInt(hex[1], 16);
    return isAllowedPrefixByte(parsed) ? parsed : null;
  }

  const caret = /^\^(.)$/.exec(value);
  if (caret?.[1]) return prefixFromKey(caret[1]);

  const ctrl = /^ctrl\+(.+)$/i.exec(value);
  if (ctrl?.[1]) return prefixFromKey(normalizeCtrlKey(ctrl[1]));

  if (value.length === 1) return prefixFromKey(value);
  return null;
}

export function formatPrefixLabel(byte: number): string {
  if (byte === 0x1c) return "Ctrl+\\";
  if (byte >= 1 && byte <= 26) return `Ctrl+${String.fromCharCode(64 + byte)}`;
  if (byte === 0x1d) return "Ctrl+]";
  if (byte === 0x1e) return "Ctrl+^";
  if (byte === 0x1f) return "Ctrl+_";
  return `0x${byte.toString(16)}`;
}

export function loadWrapperConfig(configDir: string): WrapperFileConfig {
  const file = join(configDir, "config.json");
  if (!existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, { encoding: "utf8" }));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const prefix = (parsed as { prefix?: unknown }).prefix;
    return typeof prefix === "string" ? { prefix } : {};
  } catch {
    return {};
  }
}

export function resolvePrefix(options?: {
  env?: NodeJS.Dict<string>;
  configDir?: string;
}): ResolvedPrefix {
  const environment = options?.env ?? process.env;
  const fromEnv = environment.WRAPPER_PREFIX;
  if (fromEnv && fromEnv.trim().length > 0) {
    const parsed = parsePrefix(fromEnv);
    if (parsed !== null) {
      return { byte: parsed, label: formatPrefixLabel(parsed), source: "env" };
    }
    log.warn("invalid WRAPPER_PREFIX; using default Ctrl+\\", { value: fromEnv });
  }

  const configDir = options?.configDir ?? paths.config();
  const config = loadWrapperConfig(configDir);
  if (config.prefix) {
    const parsed = parsePrefix(config.prefix);
    if (parsed !== null) {
      return { byte: parsed, label: formatPrefixLabel(parsed), source: "config" };
    }
    log.warn("invalid prefix in config.json; using default Ctrl+\\", { value: config.prefix });
  }

  return {
    byte: DEFAULT_PREFIX_BYTE,
    label: formatPrefixLabel(DEFAULT_PREFIX_BYTE),
    source: "default",
  };
}

function normalizeCtrlKey(raw: string): string {
  if (raw === "\\\\" || raw === "\\") return "\\";
  return raw;
}

function prefixFromKey(key: string): number | null {
  if (key.length !== 1) return null;
  const ctrl = key.charCodeAt(0) & 0x1f;
  return isAllowedPrefixByte(ctrl) ? ctrl : null;
}
