/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as autumn from "../autumn.js";
import type * as billing from "../billing.js";
import type * as deviceAuth from "../deviceAuth.js";
import type * as http from "../http.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_middleware from "../lib/middleware.js";
import type * as lib_onboarding from "../lib/onboarding.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_relayTicket from "../lib/relayTicket.js";
import type * as lib_sessionConfig from "../lib/sessionConfig.js";
import type * as lib_types from "../lib/types.js";
import type * as onboarding from "../onboarding.js";
import type * as relay from "../relay.js";
import type * as session from "../session.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  autumn: typeof autumn;
  billing: typeof billing;
  deviceAuth: typeof deviceAuth;
  http: typeof http;
  "lib/errors": typeof lib_errors;
  "lib/logger": typeof lib_logger;
  "lib/middleware": typeof lib_middleware;
  "lib/onboarding": typeof lib_onboarding;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/relayTicket": typeof lib_relayTicket;
  "lib/sessionConfig": typeof lib_sessionConfig;
  "lib/types": typeof lib_types;
  onboarding: typeof onboarding;
  relay: typeof relay;
  session: typeof session;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  autumn: import("@useautumn/convex/_generated/component.js").ComponentApi<"autumn">;
};
