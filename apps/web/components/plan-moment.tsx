import Link from "next/link";

export function PlanMoment({ variant }: { variant: "upgraded" | "cancelled" }) {
  const upgraded = variant === "upgraded";

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
              Attach from another device and share a wrapped shell. The session still starts on
              your machine; Pro is what lets it leave.
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
            <Link className="primaryAction" href="/dashboard/sessions">
              View sessions
            </Link>
            <Link className="textAction" href="/dashboard/billing">
              Billing
            </Link>
          </>
        ) : (
          <>
            <Link className="primaryAction" href="/dashboard/billing">
              Back to billing
            </Link>
            <Link className="textAction" href="/dashboard/sessions">
              View sessions
            </Link>
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
