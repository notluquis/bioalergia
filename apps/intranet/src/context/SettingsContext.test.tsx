/**
 * Tests for `SettingsContext` — backward-compat shim around the
 * features/settings/use-settings hook.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsContext, SettingsProvider } from "./SettingsContext";

describe("SettingsContext / SettingsProvider", () => {
  it("SettingsContext is a React context object", () => {
    expect(SettingsContext).toBeDefined();
    expect("Provider" in SettingsContext).toBe(true);
    expect("Consumer" in SettingsContext).toBe(true);
  });

  it("SettingsProvider renders children verbatim", () => {
    const { getByText } = render(
      <SettingsProvider>
        <span>settings-child</span>
      </SettingsProvider>
    );
    expect(getByText("settings-child")).toBeInTheDocument();
  });
});
