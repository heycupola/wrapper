"use client";

import type { PlanFeature } from "../lib/plan-features";
import { TermTip } from "./term-tip";

export function PlanFeatureText({ feature }: { feature: PlanFeature }) {
  const { label, term, definition } = feature;
  if (!term || !definition) return <>{label}</>;
  const index = label.indexOf(term);
  if (index < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, index)}
      <TermTip definition={definition}>{term}</TermTip>
      {label.slice(index + term.length)}
    </>
  );
}
