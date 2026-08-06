"use client";

import { useEffect, useRef, type ReactNode } from "react";

const emptySectionIds: readonly string[] = [];
const desktopHeaderHeight = 68;
const pageSnapThreshold = 12;
const pageSnapIdleMs = 140;

type SectionMetric = {
  element: HTMLElement;
  left: number;
  center: number;
};

function nearestSectionIndex(
  horizontalOffset: number,
  viewportWidth: number,
  sections: readonly SectionMetric[],
): number {
  const center = horizontalOffset + viewportWidth / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [index, section] of sections.entries()) {
    const distance = Math.abs(section.center - center);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }
  return nearestIndex;
}

export function HorizontalScroll({
  children,
  sectionIds = emptySectionIds,
}: {
  children: ReactNode;
  sectionIds: readonly string[];
}) {
  const experienceRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const experience = experienceRef.current;
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!experience || !scroller || !track) return;

    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const supportsScrollTimeline = CSS.supports("animation-timeline: scroll(root block)");
    const supportsScrollEnd = "onscrollend" in window;
    let revealsReady = reducedMotionQuery.matches;
    let revealFrame: number | null = null;
    let revealPaintFrame: number | null = null;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    let horizontalDistance = 0;
    let scrollStart = 0;
    let viewportWidth = 0;
    let activeIndex = -1;
    let settledIndex = 0;
    let revealedCount = 0;
    let renderedOffset = Number.NaN;
    let sectionMetrics: SectionMetric[] = [];
    let snapPoints: number[] = [];

    const markSections = (horizontalOffset: number) => {
      const nearestIndex = nearestSectionIndex(horizontalOffset, viewportWidth, sectionMetrics);
      if (nearestIndex !== activeIndex) {
        sectionMetrics[activeIndex]?.element.classList.remove("isActive");
        sectionMetrics[nearestIndex]?.element.classList.add("isActive");
        activeIndex = nearestIndex;
      }

      if (revealsReady) {
        const revealPoint = horizontalOffset + viewportWidth * 0.84;
        while (revealedCount < sectionMetrics.length) {
          const section = sectionMetrics[revealedCount];
          if (!section || (revealedCount > 0 && section.left > revealPoint)) break;
          section.element.classList.add("hasEntered");
          revealedCount += 1;
        }
      }
    };

    const updateScroll = () => {
      frameRef.current = null;
      if (mobileQuery.matches) return;

      const progress =
        horizontalDistance === 0
          ? 0
          : Math.min(1, Math.max(0, (window.scrollY - scrollStart) / horizontalDistance));
      const horizontalOffset = Math.round(progress * horizontalDistance * 100) / 100;
      if (horizontalOffset === renderedOffset) return;
      renderedOffset = horizontalOffset;
      if (!supportsScrollTimeline) {
        track.style.transform = `translate3d(${-horizontalOffset}px, 0, 0)`;
      }
      markSections(horizontalOffset);
    };

    const scheduleUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(updateScroll);
    };

    const updateLayout = () => {
      if (mobileQuery.matches) {
        experience.style.removeProperty("--horizontal-distance");
        track.style.removeProperty("transform");
        track.classList.remove("usesScrollTimeline");
        renderedOffset = Number.NaN;
        return;
      }
      sectionMetrics = sectionIds.flatMap((sectionId) => {
        const element = document.getElementById(sectionId);
        return element
          ? [
              {
                element,
                left: element.offsetLeft,
                center: element.offsetLeft + element.clientWidth / 2,
              },
            ]
          : [];
      });
      viewportWidth = scroller.clientWidth;
      revealedCount = sectionMetrics.findIndex(
        (section) => !section.element.classList.contains("hasEntered"),
      );
      if (revealedCount < 0) revealedCount = sectionMetrics.length;
      horizontalDistance = Math.max(0, track.scrollWidth - viewportWidth);
      scrollStart = window.scrollY + experience.getBoundingClientRect().top - desktopHeaderHeight;
      snapPoints = sectionMetrics.map((section) => Math.min(horizontalDistance, section.left));
      const currentOffset = Math.min(horizontalDistance, Math.max(0, window.scrollY - scrollStart));
      settledIndex = nearestSectionIndex(currentOffset, viewportWidth, sectionMetrics);
      experience.style.setProperty("--horizontal-distance", `${Math.ceil(horizontalDistance)}px`);
      scroller.classList.add("isEnhanced");
      track.classList.toggle("usesScrollTimeline", supportsScrollTimeline);
      if (supportsScrollTimeline) track.style.removeProperty("transform");
      renderedOffset = Number.NaN;
      updateScroll();
    };

    const settleOnPage = () => {
      snapTimer = null;
      if (mobileQuery.matches || snapPoints.length === 0) return;
      const currentOffset = Math.min(horizontalDistance, Math.max(0, window.scrollY - scrollStart));
      const settledPoint = snapPoints[settledIndex] ?? 0;
      const delta = currentOffset - settledPoint;
      if (Math.abs(delta) < pageSnapThreshold) {
        if (Math.abs(delta) > 0.5) window.scrollTo({ top: scrollStart + settledPoint });
        return;
      }

      const targetIndex = Math.min(
        snapPoints.length - 1,
        Math.max(0, settledIndex + (delta > 0 ? 1 : -1)),
      );
      const targetPoint = snapPoints[targetIndex];
      if (targetPoint === undefined || targetIndex === settledIndex) return;
      settledIndex = targetIndex;
      window.scrollTo({
        top: scrollStart + targetPoint,
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });
    };

    const scheduleSnap = () => {
      if (snapTimer !== null) clearTimeout(snapTimer);
      snapTimer = setTimeout(settleOnPage, pageSnapIdleMs);
    };

    const onScroll = () => {
      scheduleUpdate();
      if (!supportsScrollEnd) scheduleSnap();
    };

    const scrollToSection = (section: HTMLElement, updateHistory: boolean) => {
      if (mobileQuery.matches) return;
      const targetIndex = sectionMetrics.findIndex((metric) => metric.element === section);
      if (targetIndex >= 0) settledIndex = targetIndex;
      if (snapTimer !== null) {
        clearTimeout(snapTimer);
        snapTimer = null;
      }
      if (updateHistory) history.pushState(null, "", `#${section.id}`);
      window.scrollTo({
        top: scrollStart + Math.min(horizontalDistance, section.offsetLeft),
        behavior: reducedMotionQuery.matches ? "auto" : "smooth",
      });
    };

    const onClick = (event: MouseEvent) => {
      if (mobileQuery.matches || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      const sectionId = anchor?.getAttribute("href")?.slice(1);
      if (!sectionId || !sectionIds.includes(sectionId)) return;
      const section = document.getElementById(sectionId);
      if (!section) return;
      event.preventDefault();
      scrollToSection(section, true);
    };

    const onHashNavigation = () => {
      const sectionId = decodeURIComponent(window.location.hash.slice(1));
      if (!sectionId || !sectionIds.includes(sectionId)) return;
      const section = document.getElementById(sectionId);
      if (section) scrollToSection(section, false);
    };

    const observer = new ResizeObserver(updateLayout);
    observer.observe(scroller);
    observer.observe(track);
    for (const sectionId of sectionIds) {
      const section = document.getElementById(sectionId);
      if (section) observer.observe(section);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    if (supportsScrollEnd) window.addEventListener("scrollend", settleOnPage);
    window.addEventListener("resize", updateLayout, { passive: true });
    window.addEventListener("hashchange", onHashNavigation);
    experience.addEventListener("click", onClick);
    mobileQuery.addEventListener("change", updateLayout);
    updateLayout();
    if (!revealsReady) {
      revealFrame = requestAnimationFrame(() => {
        revealPaintFrame = requestAnimationFrame(() => {
          revealsReady = true;
          markSections(Number.isFinite(renderedOffset) ? renderedOffset : 0);
        });
      });
    }
    requestAnimationFrame(onHashNavigation);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (supportsScrollEnd) window.removeEventListener("scrollend", settleOnPage);
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("hashchange", onHashNavigation);
      experience.removeEventListener("click", onClick);
      mobileQuery.removeEventListener("change", updateLayout);
      experience.style.removeProperty("--horizontal-distance");
      track.style.removeProperty("transform");
      track.classList.remove("usesScrollTimeline");
      if (snapTimer !== null) clearTimeout(snapTimer);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (revealFrame !== null) cancelAnimationFrame(revealFrame);
      if (revealPaintFrame !== null) cancelAnimationFrame(revealPaintFrame);
    };
  }, [sectionIds]);

  return (
    <div ref={experienceRef} className="horizontalExperience">
      <main
        id="main-content"
        ref={scrollerRef}
        className="hScroller"
        aria-label="Wrapper product story"
        aria-roledescription="horizontal story controlled by vertical page scrolling"
        tabIndex={-1}
      >
        <div ref={trackRef} className="hTrack">
          {children}
        </div>
      </main>
      <footer className="landingFooterBar">
        <span>© {new Date().getFullYear()} Wrapper by Cupola Labs, LLC</span>
      </footer>
    </div>
  );
}
