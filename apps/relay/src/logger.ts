type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, message: string, data?: Record<string, unknown>): void {
  const payload: Record<string, unknown> = {
    level,
    message,
    ...(data ? { data } : {}),
  };
  const line = JSON.stringify(payload);
  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.log(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export function createLogger(scope: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      log("debug", `[${scope}] ${message}`, data);
    },
    info(message: string, data?: Record<string, unknown>) {
      log("info", `[${scope}] ${message}`, data);
    },
    warn(message: string, data?: Record<string, unknown>) {
      log("warn", `[${scope}] ${message}`, data);
    },
    error(message: string, data?: Record<string, unknown>) {
      log("error", `[${scope}] ${message}`, data);
    },
  };
}
