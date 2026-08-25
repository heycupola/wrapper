/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as appleNotifications from "../appleNotifications.js";
import type * as appleNotificationsHttp from "../appleNotificationsHttp.js";
import type * as auth from "../auth.js";
import type * as autumn from "../autumn.js";
import type * as autumnWebhook from "../autumnWebhook.js";
import type * as billing from "../billing.js";
import type * as crons from "../crons.js";
import type * as deviceAuth from "../deviceAuth.js";
import type * as http from "../http.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_appleNotification from "../lib/appleNotification.js";
import type * as lib_appleRevocation from "../lib/appleRevocation.js";
import type * as lib_emails_access_restricted from "../lib/emails/access_restricted.js";
import type * as lib_emails_account_deleted from "../lib/emails/account_deleted.js";
import type * as lib_emails_collaborator_added from "../lib/emails/collaborator_added.js";
import type * as lib_emails_grace_period_started from "../lib/emails/grace_period_started.js";
import type * as lib_emails_index from "../lib/emails/index.js";
import type * as lib_emails_plan_upgraded from "../lib/emails/plan_upgraded.js";
import type * as lib_emails_styles from "../lib/emails/styles.js";
import type * as lib_emails_welcome from "../lib/emails/welcome.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_middleware from "../lib/middleware.js";
import type * as lib_onboarding from "../lib/onboarding.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_relayTicket from "../lib/relayTicket.js";
import type * as lib_sessionConfig from "../lib/sessionConfig.js";
import type * as lib_svix from "../lib/svix.js";
import type * as lib_types from "../lib/types.js";
import type * as onboarding from "../onboarding.js";
import type * as rateLimitCleanup from "../rateLimitCleanup.js";
import type * as relay from "../relay.js";
import type * as resend from "../resend.js";
import type * as session from "../session.js";
import type * as user from "../user.js";
import type * as webhook from "../webhook.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  appleNotifications: typeof appleNotifications;
  appleNotificationsHttp: typeof appleNotificationsHttp;
  auth: typeof auth;
  autumn: typeof autumn;
  autumnWebhook: typeof autumnWebhook;
  billing: typeof billing;
  crons: typeof crons;
  deviceAuth: typeof deviceAuth;
  http: typeof http;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/appleNotification": typeof lib_appleNotification;
  "lib/appleRevocation": typeof lib_appleRevocation;
  "lib/emails/access_restricted": typeof lib_emails_access_restricted;
  "lib/emails/account_deleted": typeof lib_emails_account_deleted;
  "lib/emails/collaborator_added": typeof lib_emails_collaborator_added;
  "lib/emails/grace_period_started": typeof lib_emails_grace_period_started;
  "lib/emails/index": typeof lib_emails_index;
  "lib/emails/plan_upgraded": typeof lib_emails_plan_upgraded;
  "lib/emails/styles": typeof lib_emails_styles;
  "lib/emails/welcome": typeof lib_emails_welcome;
  "lib/errors": typeof lib_errors;
  "lib/logger": typeof lib_logger;
  "lib/middleware": typeof lib_middleware;
  "lib/onboarding": typeof lib_onboarding;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/relayTicket": typeof lib_relayTicket;
  "lib/sessionConfig": typeof lib_sessionConfig;
  "lib/svix": typeof lib_svix;
  "lib/types": typeof lib_types;
  onboarding: typeof onboarding;
  rateLimitCleanup: typeof rateLimitCleanup;
  relay: typeof relay;
  resend: typeof resend;
  session: typeof session;
  user: typeof user;
  webhook: typeof webhook;
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
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
