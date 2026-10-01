import { Html5Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { MUSIC_FILE } from "./audio.generated";
import { DURATION_SECONDS, VOICE_SPANS, VOICE_START } from "./timeline";
import { VOICE_TIMING } from "./voice.generated";

const DUCK = 0.45;
const RAMP = 0.25;
const MUSIC_GAIN = 0.7;
const MUSIC_DUCK = 0.55;

/* How much the narrator is speaking at `t`, with ramps so the music breathes between sentences. */
function speaking(t: number): number {
  return VOICE_SPANS.reduce((level, span) => {
    const v = interpolate(
      t,
      [span.start - RAMP, span.start, span.end, span.end + RAMP * 2],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    return Math.max(level, v);
  }, 0);
}

function musicVolume(t: number): number {
  const fade = interpolate(t, [0, 0.8, DURATION_SECONDS - 2.2, DURATION_SECONDS], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return MUSIC_GAIN * fade * (1 - MUSIC_DUCK * speaking(t));
}

/* Effects (and synthesised music) from generate-audio.ts, a supplied track, and the narration. */
export function Soundtrack() {
  const { fps } = useVideoConfig();

  return (
    <>
      <Html5Audio
        src={staticFile("audio/soundtrack.wav")}
        volume={(frame) => (MUSIC_FILE ? 1 : 1 - DUCK * speaking(frame / fps))}
      />
      {MUSIC_FILE ? (
        <Html5Audio src={staticFile(MUSIC_FILE)} volume={(frame) => musicVolume(frame / fps)} />
      ) : null}
      {VOICE_TIMING ? (
        <Sequence from={Math.round(VOICE_START * fps)} layout="none">
          <Html5Audio src={staticFile("audio/voice/story.mp3")} />
        </Sequence>
      ) : null}
    </>
  );
}
