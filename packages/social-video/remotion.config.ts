// Remotion config — only consumed by `remotion studio` (dev preview on the Mac).
// The programmatic render in src/render.ts sets its own options inline.
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.overrideWebpackConfig((config) => config);
