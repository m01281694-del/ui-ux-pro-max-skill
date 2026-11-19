import React from "react";
import { Composition } from "remotion";
import { Short, type ShortProps } from "./Short";
import script from "../content/v001/script.json";
import timing from "../content/v001/timing.json";

const FPS = 30;
const defaults: ShortProps = { id: script.id, voiceSrc: "v001-voice.mp3", handle: "manu.digi0", brand: script.brand, scenes: script.scenes, timing };

export const Root: React.FC = () => (
  <Composition
    id="Short"
    component={Short}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={Math.ceil((timing.duration + 0.9) * FPS)}
    defaultProps={defaults}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil((props.timing.duration + 0.9) * FPS) })}
  />
);
