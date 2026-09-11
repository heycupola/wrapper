"use client";

import { BILLING_INTERVAL_OPTIONS, type BillingInterval } from "../lib/pro-pricing";
import { Segmented } from "./ui/segmented";

export function ProIntervalSwitch({
  id,
  value,
  onChange,
  size = "md",
  className,
}: {
  id: string;
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Segmented
      id={id}
      size={size}
      className={className}
      options={BILLING_INTERVAL_OPTIONS}
      value={value}
      onChange={onChange}
      aria-label="Billing period"
    />
  );
}
