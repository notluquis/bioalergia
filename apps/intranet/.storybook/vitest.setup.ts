import { setProjectAnnotations } from "@storybook/react-vite";
import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";
import * as addonThemesAnnotations from "@storybook/addon-themes/preview";
import { beforeAll } from "vitest";

import * as previewAnnotations from "./preview";

// Hand the runtime preview + addon annotations to the Vitest browser
// runner so play functions, decorators, and a11y checks behave the same
// way they do in the Storybook UI.
const project = setProjectAnnotations([
  addonA11yAnnotations,
  addonThemesAnnotations,
  previewAnnotations,
]);

beforeAll(project.beforeAll);
