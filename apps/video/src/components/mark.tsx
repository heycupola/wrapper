export const MARK_PATH =
  "M30.52 64L25 32H31.7686L35.8429 59.5213H36.8943L42.5457 32H53.52L59.1057 59.5213H60.1571L64.2314 32H71L65.48 64H54.1114L48.5257 36.5436H47.4743L41.8886 64H30.52Z";

export function Mark({ size, tile, ink }: { size: number; tile: string; ink: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <rect width="96" height="96" rx="22" fill={tile} />
      <path d={MARK_PATH} fill={ink} />
    </svg>
  );
}
