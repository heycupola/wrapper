export type SectionMetric = {
  left: number;
  center: number;
};

export function clampHorizontalOffset(
  scrollY: number,
  start: number,
  maxTranslate: number,
): number {
  if (maxTranslate <= 0) return 0;
  return Math.min(maxTranslate, Math.max(0, scrollY - start));
}

export function horizontalStoryHeight(viewportHeight: number, maxTranslate: number): number {
  return Math.max(0, viewportHeight) + Math.max(0, maxTranslate);
}

export function sectionScrollTarget(
  start: number,
  sectionLeft: number,
  maxTranslate: number,
): number {
  return start + Math.min(Math.max(0, maxTranslate), Math.max(0, sectionLeft));
}

export function nearestSectionIndex(
  horizontalOffset: number,
  viewportWidth: number,
  sections: readonly SectionMetric[],
): number {
  if (sections.length === 0) return 0;

  const viewportCenter = horizontalOffset + viewportWidth / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [index, section] of sections.entries()) {
    const distance = Math.abs(section.center - viewportCenter);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  }

  return nearestIndex;
}
