import { Composition } from "remotion";
import { Launch, type LaunchProps } from "./launch";
import type { Dimension, ThemeName } from "./theme";
import { DURATION_SECONDS, FPS } from "./timing";

const FRAMES = [
  { id: "Launch", width: 1920, height: 1080 },
  { id: "LaunchVertical", width: 1080, height: 1920 },
] as const;
const THEMES: { theme: ThemeName; suffix: string }[] = [
  { theme: "dark", suffix: "" },
  { theme: "light", suffix: "Light" },
];
const DIMENSIONS: { dimension: Dimension; suffix: string }[] = [
  { dimension: "3d", suffix: "" },
  { dimension: "2d", suffix: "2D" },
];

const FORMATS = DIMENSIONS.flatMap(({ dimension, suffix: d }) =>
  THEMES.flatMap(({ theme, suffix: s }) =>
    FRAMES.map((frame) => ({ ...frame, id: `${frame.id}${s}${d}`, theme, dimension })),
  ),
);

export function Root() {
  return (
    <>
      {FORMATS.map((format) => (
        <Composition
          key={format.id}
          id={format.id}
          component={Launch}
          durationInFrames={Math.round(DURATION_SECONDS * FPS)}
          fps={FPS}
          width={format.width}
          height={format.height}
          defaultProps={
            {
              theme: format.theme,
              dimension: format.dimension,
              motionBlur: true,
            } satisfies LaunchProps
          }
        />
      ))}
    </>
  );
}
