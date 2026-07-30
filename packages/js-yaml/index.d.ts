export interface LoadOptions {
  filename?: string;
  schema?: unknown;
  json?: boolean;
  onWarning?: (error: Error) => void;
}

export interface DumpOptions {
  indent?: number;
  noArrayIndent?: boolean;
  skipInvalid?: boolean;
  flowLevel?: number;
  styles?: Record<string, string>;
  schema?: unknown;
  sortKeys?: boolean | ((a: string, b: string) => number);
  lineWidth?: number;
  noRefs?: boolean;
  noCompatMode?: boolean;
  condenseFlow?: boolean;
  quotingType?: "'" | '"';
  forceQuotes?: boolean;
  replacer?: (key: string, value: unknown) => unknown;
}

export function load(input: string, options?: LoadOptions): unknown;
export function loadAll(
  input: string,
  iterator?: (document: unknown) => void,
  options?: LoadOptions,
): unknown[];
export function dump(input: unknown, options?: DumpOptions): string;
export const safeLoad: typeof load;
export const safeLoadAll: typeof loadAll;
export const safeDump: typeof dump;
export const Type: unknown;
export const Schema: unknown;
export const FAILSAFE_SCHEMA: unknown;
export const JSON_SCHEMA: unknown;
export const CORE_SCHEMA: unknown;
export const DEFAULT_SCHEMA: unknown;
export const YAMLException: unknown;
export const types: unknown;

declare const yaml: {
  load: typeof load;
  loadAll: typeof loadAll;
  dump: typeof dump;
  safeLoad: typeof safeLoad;
  safeLoadAll: typeof safeLoadAll;
  safeDump: typeof safeDump;
  Type: typeof Type;
  Schema: typeof Schema;
  FAILSAFE_SCHEMA: typeof FAILSAFE_SCHEMA;
  JSON_SCHEMA: typeof JSON_SCHEMA;
  CORE_SCHEMA: typeof CORE_SCHEMA;
  DEFAULT_SCHEMA: typeof DEFAULT_SCHEMA;
  YAMLException: typeof YAMLException;
  types: typeof types;
};

export default yaml;
