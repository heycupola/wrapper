export type BillingInterval = "year" | "month";

export const BILLING_INTERVAL_OPTIONS = [
  { value: "year", label: "Yearly" },
  { value: "month", label: "Monthly" },
] as const;

export const PRO_PRICE = {
  year: {
    amount: "$99",
    period: "/ year",
    rate: { amount: "$8.25", period: "/ month" },
  },
  month: {
    amount: "$15",
    period: "/ month",
    rate: null,
  },
} as const;

export const PRO_SUMMARY = "Your shell, from another device.";
