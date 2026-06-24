// Import from the /brand subpath, NOT the barrel — the barrel pulls in
// satori + @resvg native bindings that Remotion's webpack can't bundle.
import { BRAND } from "@finanzas/social-render/brand";
import { loadFont } from "@remotion/google-fonts/IBMPlexSans";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

// `type` (not interface) so it satisfies Record<string, unknown> — Remotion v4
// requires composition props to have an index signature (4.0 migration note).
export type ReelProps = {
  kicker: string;
  title: string;
  bullets: string[];
  cta: string;
};

export const REEL_FPS = 30;
// Intro (title) + one section per bullet + outro (cta).
const INTRO_FRAMES = 75; // 2.5s
const BULLET_FRAMES = 75; // 2.5s each
const OUTRO_FRAMES = 90; // 3s

export function reelDurationInFrames(bullets: number): number {
  return INTRO_FRAMES + bullets * BULLET_FRAMES + OUTRO_FRAMES;
}

const fontStack = `${fontFamily}, ${BRAND.fontFamily}, sans-serif`;

function BrandMark(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        fontSize: 44,
        fontWeight: 600,
        color: BRAND.blue,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: BRAND.amber,
        }}
      />
      Bioalergia
    </div>
  );
}

function FadeSlide({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 120, mass: 0.6 },
  });
  const translateY = interpolate(entrance, [0, 1], [60, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)`, display: "flex" }}>
      {children}
    </div>
  );
}

function Intro({ kicker, title }: { kicker: string; title: string }): React.JSX.Element {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.cream,
        padding: 110,
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: fontStack,
      }}
    >
      <FadeSlide>
        <div
          style={{
            width: 150,
            height: 16,
            borderRadius: 8,
            backgroundColor: BRAND.amber,
            marginBottom: 56,
          }}
        />
      </FadeSlide>
      <FadeSlide delay={6}>
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: 6,
            color: BRAND.blue,
            marginBottom: 32,
          }}
        >
          {kicker.toUpperCase()}
        </div>
      </FadeSlide>
      <FadeSlide delay={12}>
        <div style={{ fontSize: 104, fontWeight: 700, color: BRAND.ink, lineHeight: 1.05 }}>
          {title}
        </div>
      </FadeSlide>
      <div style={{ position: "absolute", bottom: 110, left: 110 }}>
        <BrandMark />
      </div>
    </AbsoluteFill>
  );
}

function BulletScene({ text, index }: { text: string; index: number }): React.JSX.Element {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.white,
        padding: 110,
        flexDirection: "column",
        justifyContent: "center",
        fontFamily: fontStack,
      }}
    >
      <FadeSlide>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 28,
            backgroundColor: BRAND.blue,
            color: BRAND.white,
            fontSize: 52,
            fontWeight: 700,
            marginBottom: 56,
          }}
        >
          {index + 1}
        </div>
      </FadeSlide>
      <FadeSlide delay={8}>
        <div style={{ fontSize: 60, fontWeight: 600, color: BRAND.ink, lineHeight: 1.3 }}>
          {text}
        </div>
      </FadeSlide>
      <div style={{ position: "absolute", bottom: 110, left: 110 }}>
        <BrandMark />
      </div>
    </AbsoluteFill>
  );
}

function Outro({ cta }: { cta: string }): React.JSX.Element {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.blue,
        padding: 110,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        fontFamily: fontStack,
      }}
    >
      <FadeSlide>
        <div
          style={{
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: 6,
            color: BRAND.amber,
            marginBottom: 36,
          }}
        >
          BIOALERGIA · CONCEPCIÓN
        </div>
      </FadeSlide>
      <FadeSlide delay={8}>
        <div style={{ fontSize: 84, fontWeight: 700, color: BRAND.white, lineHeight: 1.1 }}>
          {cta}
        </div>
      </FadeSlide>
      <FadeSlide delay={16}>
        <div
          style={{
            marginTop: 64,
            padding: "28px 56px",
            borderRadius: 24,
            backgroundColor: BRAND.amber,
            color: BRAND.ink,
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          Agenda tu evaluación
        </div>
      </FadeSlide>
    </AbsoluteFill>
  );
}

export function ReelTemplate({ kicker, title, bullets, cta }: ReelProps): React.JSX.Element {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.cream }}>
      <Sequence durationInFrames={INTRO_FRAMES}>
        <Intro kicker={kicker} title={title} />
      </Sequence>
      {bullets.map((text, i) => (
        <Sequence
          key={i}
          from={INTRO_FRAMES + i * BULLET_FRAMES}
          durationInFrames={BULLET_FRAMES}
        >
          <BulletScene text={text} index={i} />
        </Sequence>
      ))}
      <Sequence from={INTRO_FRAMES + bullets.length * BULLET_FRAMES} durationInFrames={OUTRO_FRAMES}>
        <Outro cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
}
