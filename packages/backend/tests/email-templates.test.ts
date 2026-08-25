import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import AccessRestrictedEmail from "../convex/lib/emails/access_restricted";
import AccountDeletedEmail from "../convex/lib/emails/account_deleted";
import CollaboratorAddedEmail from "../convex/lib/emails/collaborator_added";
import GracePeriodStartedEmail from "../convex/lib/emails/grace_period_started";
import PlanUpgradedEmail from "../convex/lib/emails/plan_upgraded";
import WelcomeEmail from "../convex/lib/emails/welcome";
import { EmailKind } from "../convex/lib/types";

describe("email templates", () => {
  test("keeps Relic email kinds and Wrapper product copy", async () => {
    expect(Object.values(EmailKind)).toEqual([
      EmailKind.AccessRestricted,
      EmailKind.AccountDeleted,
      EmailKind.CollaboratorAdded,
      EmailKind.GracePeriodStarted,
      EmailKind.PlanUpgraded,
      EmailKind.Welcome,
    ]);

    const welcome = await render(
      WelcomeEmail({ userName: "Ada", dashboardUrl: "https://example" }),
    );
    expect(welcome).toContain("Welcome to Wrapper");
    expect(welcome).toContain("wrapper auth login");
    expect(welcome).not.toContain("7 days");

    const upgraded = await render(PlanUpgradedEmail({ userName: "Ada" }));
    expect(upgraded).toContain("Wrapper Pro");
    expect(upgraded).toContain("Remote attach");

    const grace = await render(GracePeriodStartedEmail({ userName: "Ada", daysRemaining: 7 }));
    expect(grace).toContain("Your plan has changed");
    expect(grace).not.toContain("7 days");
    expect(grace).not.toContain("grace period");

    const restricted = await render(
      AccessRestrictedEmail({
        userName: "Ada",
        ownedSessionCount: 2,
        sharedSessionCount: 1,
      }),
    );
    expect(restricted).toContain("hosted");
    expect(restricted).toContain("sessions");
    expect(restricted).not.toContain("grace period");

    const deleted = await render(
      AccountDeletedEmail({ userName: "Ada", sessionsDeleted: 1, ticketsRevoked: 2 }),
    );
    expect(deleted).toContain("deleted");
    expect(deleted).toContain("tickets");
    expect(deleted).toContain("revoked");

    const collaborator = await render(
      CollaboratorAddedEmail({
        userName: "Ada",
        ownerName: "Can",
        projectName: "host-session",
      }),
    );
    expect(collaborator).toContain("given access to a session");
    expect(collaborator).toContain("share code");
  });
});
