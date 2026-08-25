import { Resend as ResendComponent } from "@convex-dev/resend";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import {
  AccessRestrictedEmail,
  AccountDeletedEmail,
  CollaboratorAddedEmail,
  GracePeriodStartedEmail,
  PlanUpgradedEmail,
  WelcomeEmail,
} from "./lib/emails/index.ts";
import { createLogger } from "./lib/logger.ts";
import { EmailKind } from "./lib/types.ts";

const log = createLogger("resend");

let _resendSdk: Resend | null = null;

export function getResendSdk(): Resend {
  if (!_resendSdk) {
    _resendSdk = new Resend(process.env.RESEND_API_KEY);
  }
  return _resendSdk;
}

export const resend: ResendComponent = new ResendComponent(components.resend, {});

const FROM_EMAIL_ADDRESS = process.env.FROM_EMAIL_ADDRESS || "Wrapper <notifications@wrapper.sh>";
const FROM_EMAIL_ADDRESS_PERSONAL =
  process.env.FROM_EMAIL_ADDRESS_PERSONAL || "Can from Wrapper <can@wrapper.sh>";
const SITE_URL =
  process.env.SITE_URL ||
  (process.env.ENVIRONMENT === "development" ? "http://localhost:3000" : "https://www.wrapper.sh");

export const getUpgradeUrl = () => `${SITE_URL}/dashboard/billing`;
export const getDashboardUrl = () => `${SITE_URL}/dashboard`;

type EmailData =
  | {
      kind: EmailKind.AccessRestricted;
      userName: string;
      ownedSessionCount: number;
      sharedSessionCount: number;
    }
  | {
      kind: EmailKind.AccountDeleted;
      userName: string;
      sessionsDeleted: number;
      ticketsRevoked: number;
    }
  | {
      kind: EmailKind.CollaboratorAdded;
      userName: string;
      projectName: string;
      ownerName: string;
    }
  | {
      kind: EmailKind.GracePeriodStarted;
      userName: string;
      daysRemaining: number;
    }
  | {
      kind: EmailKind.PlanUpgraded;
      userName: string;
    }
  | {
      kind: EmailKind.Welcome;
      userName: string;
    };

async function renderEmailTemplate(data: EmailData): Promise<string> {
  switch (data.kind) {
    case EmailKind.AccessRestricted:
      return await render(
        AccessRestrictedEmail({
          userName: data.userName,
          ownedSessionCount: data.ownedSessionCount,
          sharedSessionCount: data.sharedSessionCount,
          upgradeUrl: getUpgradeUrl(),
        }),
      );
    case EmailKind.AccountDeleted:
      return await render(
        AccountDeletedEmail({
          userName: data.userName,
          sessionsDeleted: data.sessionsDeleted,
          ticketsRevoked: data.ticketsRevoked,
        }),
      );
    case EmailKind.CollaboratorAdded:
      return await render(
        CollaboratorAddedEmail({
          userName: data.userName,
          projectName: data.projectName,
          ownerName: data.ownerName,
          dashboardUrl: getDashboardUrl(),
        }),
      );
    case EmailKind.GracePeriodStarted:
      return await render(
        GracePeriodStartedEmail({
          userName: data.userName,
          daysRemaining: data.daysRemaining,
          upgradeUrl: getUpgradeUrl(),
        }),
      );
    case EmailKind.PlanUpgraded:
      return await render(
        PlanUpgradedEmail({
          userName: data.userName,
          dashboardUrl: getDashboardUrl(),
        }),
      );
    case EmailKind.Welcome:
      return await render(
        WelcomeEmail({
          userName: data.userName,
          dashboardUrl: getDashboardUrl(),
        }),
      );
  }
}

function getFromAddress(kind: EmailKind): string {
  return kind === EmailKind.Welcome ? FROM_EMAIL_ADDRESS_PERSONAL : FROM_EMAIL_ADDRESS;
}

function getEmailSubject(kind: EmailKind): string {
  switch (kind) {
    case EmailKind.AccessRestricted:
      return "Remote access is no longer available";
    case EmailKind.AccountDeleted:
      return "Your Wrapper account has been deleted";
    case EmailKind.CollaboratorAdded:
      return "You've been given access to a session";
    case EmailKind.GracePeriodStarted:
      return "Your Wrapper plan has changed";
    case EmailKind.PlanUpgraded:
      return "Welcome to Wrapper Pro";
    case EmailKind.Welcome:
      return "Welcome to Wrapper";
  }
}

export const sendEmail = async (
  ctx: ActionCtx,
  userId: string,
  to: string,
  data: EmailData,
): Promise<{ emailId: string }> => {
  if (!process.env.RESEND_API_KEY) {
    return { emailId: "skipped" };
  }

  const from = getFromAddress(data.kind);
  const subject = getEmailSubject(data.kind);
  const html = await renderEmailTemplate(data);

  const emailId = await resend.sendEmailManually(
    ctx,
    { from, to, subject },
    async (sentEmailId) => {
      const { data: resendData, error } = await getResendSdk().emails.send({
        from,
        to,
        subject,
        html,
        headers: {
          "Idempotency-Key": sentEmailId,
        },
        tags: [
          { name: "userId", value: userId },
          { name: "kind", value: data.kind },
          { name: "emailId", value: sentEmailId },
        ],
      });

      if (error) {
        log.error("Resend API error", { kind: data.kind, to, error: error.message });
        throw new Error(`Failed to send: ${error.message}`);
      }

      if (!resendData?.id) {
        log.error("No email ID returned from Resend", { kind: data.kind, to });
        throw new Error("No email ID returned from Resend");
      }

      return resendData.id;
    },
  );

  log.info("Email sent", { kind: data.kind, to, emailId });

  return { emailId };
};

export const sendEmailDirect = async (
  to: string,
  data: EmailData,
): Promise<{ emailId: string }> => {
  if (!process.env.RESEND_API_KEY) {
    return { emailId: "skipped" };
  }

  const from = getFromAddress(data.kind);
  const subject = getEmailSubject(data.kind);
  const html = await renderEmailTemplate(data);

  const { data: resendData, error } = await getResendSdk().emails.send({
    from,
    to,
    subject,
    html,
    tags: [{ name: "kind", value: data.kind }],
  });

  if (error) {
    log.error("Direct email send error", { kind: data.kind, to, error: error.message });
    return { emailId: "failed" };
  }

  log.info("Direct email sent", { kind: data.kind, to, emailId: resendData?.id });
  return { emailId: resendData?.id || "unknown" };
};
