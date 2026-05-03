import { ConvexError, type Value } from "convex/values";
import { ErrorSeverity, type JsonMap } from "./types";

export enum ErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  INSUFFICIENT_PERMISSION = "INSUFFICIENT_PERMISSION",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  INVALID_ARGUMENTS = "INVALID_ARGUMENTS",
  INVALID_OPERATION = "INVALID_OPERATION",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
}

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED]: "Please sign in to continue",
  [ErrorCode.INSUFFICIENT_PERMISSION]: "You do not have permission to perform this action",
  [ErrorCode.RESOURCE_NOT_FOUND]: "Resource not found",
  [ErrorCode.INVALID_ARGUMENTS]: "Invalid arguments provided",
  [ErrorCode.INVALID_OPERATION]: "Invalid operation",
  [ErrorCode.RATE_LIMIT_EXCEEDED]: "Rate limit exceeded. Please slow down",
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: "External service error",
  [ErrorCode.SERVER_ERROR]: "An internal server error occurred",
};

export interface ErrorOptions {
  code: ErrorCode;
  message?: string;
  severity?: ErrorSeverity;
  metadata?: JsonMap;
}

export function createError(options: ErrorOptions): Error {
  const { code, message, severity = ErrorSeverity.Medium, metadata } = options;
  const payload: Record<string, unknown> = {
    code,
    severity,
    message: message ?? DEFAULT_MESSAGES[code],
  };
  if (metadata) Object.assign(payload, metadata);
  return new ConvexError(payload as Value) as Error;
}
