"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { PlanFeature } from "../../../lib/plan-features";

const HIDE_MS = 180;
const VIEWPORT_PAD = 12;

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
  /** Primary action for this plan, pinned to the bottom of the card. */
  action?: ReactNode;
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
  action,
  children,
}: PlanCardProps) {
  const titleId = useId();
  const featuresId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const measure = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const toast = toastRef.current;
    const width = Math.min(320, Math.max(rect.width, 220));
    const height = toast?.offsetHeight ?? 168;
    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_PAD) {
      left = Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD);
    }
    const below = rect.bottom + 8;
    const top =
      below + height > window.innerHeight - VIEWPORT_PAD
        ? Math.max(VIEWPORT_PAD, rect.top - height - 8)
        : below;
    setCoords({ top, left, width });
  }, []);

  const show = useCallback(() => {
    cancelHide();
    measure();
    setOpen(true);
  }, [cancelHide, measure]);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setOpen(false), HIDE_MS);
  }, [cancelHide]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    function onMove() {
      measure();
    }
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("wheel", onMove, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("wheel", onMove, true);
    };
  }, [open, measure]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget;
      if (next instanceof Node && card?.contains(next)) return;
      if (next instanceof Node && toastRef.current?.contains(next)) return;
      scheduleHide();
    }

    card.addEventListener("mouseenter", show);
    card.addEventListener("mouseleave", scheduleHide);
    card.addEventListener("focusin", show);
    card.addEventListener("focusout", onFocusOut);
    return () => {
      card.removeEventListener("mouseenter", show);
      card.removeEventListener("mouseleave", scheduleHide);
      card.removeEventListener("focusin", show);
      card.removeEventListener("focusout", onFocusOut);
    };
  }, [show, scheduleHide]);

  useEffect(() => {
    if (!open) return;
    const toast = toastRef.current;
    if (!toast) return;
    toast.addEventListener("mouseenter", show);
    toast.addEventListener("mouseleave", scheduleHide);
    return () => {
      toast.removeEventListener("mouseenter", show);
      toast.removeEventListener("mouseleave", scheduleHide);
    };
  }, [open, show, scheduleHide]);

  useEffect(() => () => cancelHide(), [cancelHide]);

  return (
    <article
      ref={cardRef}
      className={`dashboardPanel dashboardPlanCard${highlighted ? " dashboardProPanel" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={featuresId}
      data-open={open ? "" : undefined}
    >
      <header className="dashboardPlanHead">
        <div className="dashboardPlanTop">
          <div className="dashboardPlanName">
            <span className="dashboardPanelLabel">{label}</span>
            <h2 id={titleId}>{name}</h2>
          </div>
          {priceControls}
        </div>
        <div
          className="dashboardPlanPriceStack"
          data-interval={priceControls ? "" : undefined}
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
        <p className="dashboardPriceLead">{summary}</p>
      </header>
      {action ? <div className="dashboardPlanFoot">{action}</div> : null}
      <ul id={featuresId} className="visuallyHidden">
        {features.map((feature) => (
          <li key={feature.label}>{feature.label}</li>
        ))}
      </ul>
      {open && coords
        ? createPortal(
            <div
              ref={toastRef}
              className={`dashboardPlanToast${highlighted ? " dashboardPlanToastPro" : ""}`}
              style={{ top: coords.top, left: coords.left, width: coords.width }}
            >
              <p className="dashboardPlanToastLabel">Included in {name}</p>
              <ul className="dashboardPlanFeatures">
                {features.map((feature) => (
                  <li key={feature.label}>{feature.label}</li>
                ))}
                {children ? <li>{children}</li> : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
