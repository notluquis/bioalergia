import React from "react";
import { type CalculateMetadataFunction, Composition, registerRoot } from "remotion";

import { REEL_FPS, ReelTemplate, reelDurationInFrames, type ReelProps } from "./ReelTemplate.tsx";

const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: reelDurationInFrames(props.bullets.length),
});

const defaultProps = {
  kicker: "Alergias",
  title: "Rinitis alérgica: cómo reconocerla",
  bullets: [
    "Estornudos, picazón nasal y congestión que duran semanas.",
    "Empeora en primavera por el polen del Bío Bío.",
    "Una evaluación con especialista identifica el alérgeno.",
  ],
  cta: "Consulta a tiempo y respira mejor",
} satisfies ReelProps;

export const Root: React.FC = () => {
  return (
    <Composition
      id="reel"
      component={ReelTemplate}
      width={1080}
      height={1920}
      fps={REEL_FPS}
      durationInFrames={reelDurationInFrames(defaultProps.bullets.length)}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};

registerRoot(Root);
