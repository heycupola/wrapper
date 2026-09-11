"use client";

import { useEffect } from "react";
import { trackWebEvent } from "../lib/posthog";
import { Button } from "./ui/button";

export function PlanMoment({ variant }: { variant: "upgraded" | "cancelled" }) {
  const upgraded = variant === "upgraded";

  useEffect(() => {
    trackWebEvent(upgraded ? "web_subscription_completed" : "web_subscription_cancelled");
  }, [upgraded]);

  return (
    <section className="planMomentCard" data-variant={variant} aria-labelledby="plan-moment-title">
      <div className="planMomentMark" aria-hidden="true">
        {upgraded ? <UpgradedMark /> : <CancelledMark />}
      </div>
      <div className="planMomentCopy">
        {upgraded ? (
          <>
            <p className="dashboardPanelLabel">Pro</p>
            <h1 id="plan-moment-title">You unlocked remote sessions</h1>
            <p>
              Attach from another device and share a wrapped shell. The session still starts on your
              machine; Pro is what lets it leave.
            </p>
          </>
        ) : (
          <>
            <p className="dashboardPanelLabel">Free</p>
            <h1 id="plan-moment-title">Back on this machine</h1>
            <p>
              Local wrapping stays. Remote attach and sharing pause until you upgrade again. Nothing
              else in your profile changes.
            </p>
          </>
        )}
      </div>
      <div className="planMomentActions">
        {upgraded ? (
          <>
            <Button variant="primary" href="/dashboard/sessions">
              View sessions
            </Button>
            <Button href="/dashboard/billing">Billing</Button>
          </>
        ) : (
          <>
            <Button variant="primary" href="/dashboard/billing">
              Back to billing
            </Button>
            <Button href="/dashboard/sessions">View sessions</Button>
          </>
        )}
      </div>
    </section>
  );
}

function UpgradedMark() {
  return (
    <svg className="planMomentSvg" viewBox="0 0 120 120" fill="none">
      <circle className="planMomentRing" cx="60" cy="60" r="36" />
      <path className="planMomentStroke" d="M44 61.5 54.5 72 77 47" />
    </svg>
  );
}

function CancelledMark() {
  return (
    <svg className="planMomentSvg" viewBox="0 0 120 120" fill="none">
      <circle className="planMomentRing" cx="60" cy="60" r="36" />
      <path className="planMomentStroke" d="M42 60h36" />
    </svg>
  );
}
