"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  clampHorizontalOffset,
  horizontalStoryHeight,
  nearestSectionIndex,
  sectionScrollTarget,
  type SectionMetric,
} from "./horizontal-scroll-math";

const desktopQueryString = "(min-width: 1024px)";
const reducedMotionQueryString = "(prefers-reduced-motion: reduce)";

type MeasuredSection = SectionMetric & {
  element: HTMLElement;
};

type LenisController = {
  destroy: () => void;
  scrollTo: (
    target: number,
    options?: { duration?: number; force?: boolean; immediate?: boolean },
  ) => void;
};

export function HorizontalScroll({
  children,
  sectionIds,
}: {
  children: ReactNode;
  sectionIds: readonly string[];
}) {
  const experienceRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const experience = experienceRef.current;
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!experience || !scroller || !track) return;

    const desktopQuery = window.matchMedia(desktopQueryString);
    const reducedMotionQuery = window.matchMedia(reducedMotionQueryString);
    let measuredSections: MeasuredSection[] = [];
    let maxTranslate = 0;
    let storyStart = 0;
    let viewportWidth = 0;
    let activeSection = -1;
    let horizontalActive = false;
    let renderFrame: number | null = null;
    let measureFrame: number | null = null;
    let verticalObserver: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let lenis: LenisController | null = null;
    let lenisGeneration = 0;
    let initialHashApplied = false;

    const sectionElements = () =>
      sectionIds.flatMap((id) => {
        const element = document.getElementById(id);
        return element ? [element] : [];
      });

    const updateActiveSection = (horizontalOffset: number) => {
      if (measuredSections.length === 0) return;
      const nextIndex = nearestSectionIndex(horizontalOffset, viewportWidth, measuredSections);
      if (nextIndex === activeSection) return;

      measuredSections[activeSection]?.element.classList.remove("isActive");
      const nextSection = measuredSections[nextIndex];
      nextSection?.element.classList.add("isActive", "hasEntered");
      activeSection = nextIndex;
    };

    const render = () => {
      renderFrame = null;
      if (!horizontalActive) return;

      const offset = clampHorizontalOffset(window.scrollY, storyStart, maxTranslate);
      const roundedOffset = Math.round(offset * 1000) / 1000;
      track.style.transform = `translate3d(${-roundedOffset}px, 0, 0)`;

      const revealPoint = offset + viewportWidth * 0.82;
      for (const section of measuredSections) {
        if (section.left <= revealPoint) section.element.classList.add("hasEntered");
      }
      updateActiveSection(offset);
    };

    const scheduleRender = () => {
      if (renderFrame !== null) return;
      renderFrame = requestAnimationFrame(render);
    };

    const scrollToSection = (section: HTMLElement, updateHistory: boolean, immediate = false) => {
      if (!horizontalActive) return;
      const target = sectionScrollTarget(storyStart, section.offsetLeft, maxTranslate);
      if (updateHistory) history.pushState(null, "", `#${section.id}`);

      if (lenis) {
        lenis.scrollTo(
          target,
          immediate ? { immediate: true, force: true } : { duration: 0.9, force: true },
        );
      } else {
        window.scrollTo({ top: target, behavior: immediate ? "auto" : "smooth" });
      }
    };

    const navigateToHash = (updateHistory = false, immediate = false) => {
      const sectionId = decodeURIComponent(window.location.hash.slice(1));
      if (!sectionId || !sectionIds.includes(sectionId)) return;
      const section = document.getElementById(sectionId);
      if (section) scrollToSection(section, updateHistory, immediate);
    };

    const measure = () => {
      measureFrame = null;
      if (!horizontalActive) return;

      viewportWidth = scroller.clientWidth || window.innerWidth;
      const viewportHeight = scroller.clientHeight || window.innerHeight;
      maxTranslate = Math.max(0, track.scrollWidth - viewportWidth);
      storyStart = window.scrollY + experience.getBoundingClientRect().top;
      measuredSections = sectionElements().map((element) => ({
        element,
        left: element.offsetLeft,
        center: element.offsetLeft + element.clientWidth / 2,
      }));

      experience.style.height = `${Math.ceil(horizontalStoryHeight(viewportHeight, maxTranslate))}px`;
      render();

      if (!initialHashApplied && window.location.hash) {
        initialHashApplied = true;
        requestAnimationFrame(() => navigateToHash(false, true));
      }
    };

    const scheduleMeasure = () => {
      if (measureFrame !== null) cancelAnimationFrame(measureFrame);
      measureFrame = requestAnimationFrame(measure);
    };

    const stopVerticalObserver = () => {
      verticalObserver?.disconnect();
      verticalObserver = null;
    };

    const startVerticalObserver = () => {
      if (verticalObserver) return;
      verticalObserver = new IntersectionObserver(
        (entries) => {
          let mostVisible: IntersectionObserverEntry | undefined;
          for (const entry of entries) {
            entry.target.classList.toggle("isActive", entry.isIntersecting);
            if (entry.isIntersecting) entry.target.classList.add("hasEntered");
            if (
              entry.isIntersecting &&
              (!mostVisible || entry.intersectionRatio > mostVisible.intersectionRatio)
            ) {
              mostVisible = entry;
            }
          }

          const visible = mostVisible?.target;
          if (!(visible instanceof HTMLElement)) return;
          const nextIndex = sectionIds.indexOf(visible.id);
          if (nextIndex >= 0) activeSection = nextIndex;
        },
        { threshold: [0.15, 0.35, 0.6] },
      );
      for (const section of sectionElements()) verticalObserver.observe(section);
    };

    const destroyLenis = () => {
      lenisGeneration += 1;
      lenis?.destroy();
      lenis = null;
    };

    const startLenis = async () => {
      const generation = ++lenisGeneration;
      const { default: Lenis } = await import("lenis");
      if (generation !== lenisGeneration || !horizontalActive) return;
      lenis = new Lenis({
        autoRaf: true,
        gestureOrientation: "vertical",
        lerp: 0.12,
        overscroll: false,
        smoothWheel: true,
        wheelMultiplier: 1,
      });
      if (measuredSections.length > 0 && window.location.hash) {
        navigateToHash(false, true);
      }
    };

    const clearHorizontalLayout = () => {
      experience.style.removeProperty("height");
      track.style.removeProperty("transform");
      measuredSections = [];
      maxTranslate = 0;
      storyStart = 0;
      viewportWidth = 0;
    };

    const syncMode = () => {
      const nextHorizontal = desktopQuery.matches && !reducedMotionQuery.matches;
      if (nextHorizontal === horizontalActive) {
        if (horizontalActive) scheduleMeasure();
        return;
      }

      horizontalActive = nextHorizontal;
      experience.classList.toggle("isHorizontal", horizontalActive);
      scroller.classList.toggle("isHorizontal", horizontalActive);

      if (horizontalActive) {
        stopVerticalObserver();
        void startLenis();
        scheduleMeasure();
      } else {
        destroyLenis();
        clearHorizontalLayout();
        startVerticalObserver();
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (!horizontalActive || event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (
        !anchor ||
        anchor.target ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const sectionId = anchor.getAttribute("href")?.slice(1);
      if (!sectionId || !sectionIds.includes(sectionId)) return;
      const section = document.getElementById(sectionId);
      if (!section) return;
      event.preventDefault();
      scrollToSection(section, true);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!horizontalActive || !(event.target instanceof Element)) return;
      const section = event.target.closest<HTMLElement>(".landingSection");
      if (section && !section.classList.contains("isActive")) scrollToSection(section, false);
    };

    const onHashChange = () => {
      if (horizontalActive) navigateToHash();
    };

    resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(scroller);
    resizeObserver.observe(track);
    for (const section of sectionElements()) resizeObserver.observe(section);

    window.addEventListener("scroll", scheduleRender, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    window.addEventListener("orientationchange", scheduleMeasure);
    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onDocumentClick);
    experience.addEventListener("focusin", onFocusIn);
    desktopQuery.addEventListener("change", syncMode);
    reducedMotionQuery.addEventListener("change", syncMode);
    syncMode();

    if (!horizontalActive) startVerticalObserver();

    return () => {
      resizeObserver?.disconnect();
      stopVerticalObserver();
      destroyLenis();
      window.removeEventListener("scroll", scheduleRender);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onDocumentClick);
      experience.removeEventListener("focusin", onFocusIn);
      desktopQuery.removeEventListener("change", syncMode);
      reducedMotionQuery.removeEventListener("change", syncMode);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      if (measureFrame !== null) cancelAnimationFrame(measureFrame);
      clearHorizontalLayout();
    };
  }, [sectionIds]);

  return (
    <div ref={experienceRef} className="landingExperience">
      <main
        id="main-content"
        ref={scrollerRef}
        className="landingScroller"
        aria-label="Wrapper product story"
        tabIndex={-1}
      >
        <div ref={trackRef} className="landingTrack">
          {children}
        </div>
      </main>
    </div>
  );
}
