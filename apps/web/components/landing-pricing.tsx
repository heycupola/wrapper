"use client";

import { useId, useState } from "react";
import { INSTALL_SCENE_ID } from "../lib/landing-scene";
import { FREE_PLAN_FEATURES, PRO_PLAN_FEATURES } from "../lib/plan-features";
import { PRO_PRICE, PRO_SUMMARY, type BillingInterval } from "../lib/pro-pricing";
import { IosViewerCta } from "./ios-viewer-cta";
import { PlanFeatureText } from "./plan-feature-text";
import { ProIntervalSwitch } from "./pro-interval-switch";
import { Button } from "./ui/button";
import { segmentedPanelId, segmentedTabId } from "./ui/segmented";

const INSTALL_HREF = `#${INSTALL_SCENE_ID}`;

export function LandingPricingCards() {
  const switchId = useId();
  const [interval, setInterval] = useState<BillingInterval>("year");
  const price = PRO_PRICE[interval];
  const panelId = segmentedPanelId(switchId, interval);

  return (
    <div className="landingPriceGrid">
      <article className="landingPriceCard" aria-labelledby="plan-free-title">
        <header>
          <h3 id="plan-free-title">Free</h3>
          <p className="landingPrice">
            <strong>$0</strong>
            <span>forever</span>
          </p>
          <p className="landingPriceLead">Your shell, on this machine.</p>
        </header>
        <ul>
          {FREE_PLAN_FEATURES.map((feature) => (
            <li key={feature.label}>
              <PlanFeatureText feature={feature} />
            </li>
          ))}
        </ul>
        <Button size="lg" block href={INSTALL_HREF}>
          Install Wrapper
        </Button>
      </article>

      <article className="landingPriceCard landingPriceCardPro" aria-labelledby="plan-pro-title">
        <header>
          <h3 id="plan-pro-title">
            Pro <small>Remote access</small>
          </h3>
          <div className="landingPriceOffer">
            <div
              className="landingPriceStack"
              id={panelId}
              role="tabpanel"
              aria-labelledby={segmentedTabId(switchId, interval)}
            >
              <p className="landingPrice">
                <strong>{price.amount}</strong>
                <span>{price.period}</span>
              </p>
              {price.rate ? (
                <p className="landingPriceRate">
                  <strong>{price.rate.amount}</strong>
                  <span>{price.rate.period}</span>
                </p>
              ) : null}
            </div>
            <ProIntervalSwitch
              id={switchId}
              className="landingPriceInterval"
              size="sm"
              value={interval}
              onChange={setInterval}
            />
          </div>
          <p className="landingPriceLead">{PRO_SUMMARY}</p>
        </header>
        <ul>
          {PRO_PLAN_FEATURES.map((feature) => (
            <li key={feature.label}>
              <PlanFeatureText feature={feature} />
            </li>
          ))}
          <li>
            <IosViewerCta variant="text" />
          </li>
        </ul>
        <Button variant="primary" size="lg" block href="/dashboard">
          Choose Pro
        </Button>
        <p className="landingMicrocopy">Sign in to upgrade from the dashboard.</p>
      </article>
    </div>
  );
}
