"use client";

import { useId, type ReactNode } from "react";
import { PlanFeatureText } from "../../../components/plan-feature-text";
import type { PlanFeature } from "../../../lib/plan-features";

type PlanCardProps = {
  name: string;
  label: string;
  price: string;
  period: string;
  summary: string;
  features: readonly PlanFeature[];
  highlighted?: boolean;
  /** When this card is driven by a period switch, the price is the tabpanel. */
  priceId?: string;
  priceLabelledBy?: string;
  /** Yearly as a monthly rate, shown under the list price. */
  priceRate?: { amount: string; period: string };
  /** The control that changes the price, such as a billing period switch. */
  priceControls?: ReactNode;
  children?: ReactNode;
};

export function PlanCard({
  name,
  label,
  price,
  period,
  summary,
  features,
  highlighted = false,
  priceId,
  priceLabelledBy,
  priceRate,
  priceControls,
  children,
}: PlanCardProps) {
  const titleId = useId();

  return (
    <article
      className={`dashboardPanel dashboardPlanCard${highlighted ? " dashboardProPanel" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="dashboardPlanHead">
        <div className="dashboardPlanName">
          <span className="dashboardPanelLabel">{label}</span>
          <h2 id={titleId}>{name}</h2>
        </div>
        <div className="dashboardPlanOffer" data-interval={priceControls ? "" : undefined}>
          <div
            id={priceId}
            role={priceId ? "tabpanel" : undefined}
            aria-labelledby={priceLabelledBy}
          >
            <p className="dashboardPlanPrice">
              <strong>{price}</strong>
              <span>{period}</span>
            </p>
            {priceRate ? (
              <p className="dashboardPlanRate">
                <strong>{priceRate.amount}</strong>
                <span>{priceRate.period}</span>
              </p>
            ) : null}
          </div>
          {priceControls}
        </div>
      </div>
      <p className="dashboardPriceLead">{summary}</p>
      <ul className="dashboardPlanFeatures">
        {features.map((feature) => (
          <li key={feature.label}>
            <PlanFeatureText feature={feature} />
          </li>
        ))}
        {children ? <li>{children}</li> : null}
      </ul>
    </article>
  );
}
