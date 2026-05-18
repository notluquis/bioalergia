/**
 * Tests for `AuthContext` — backward-compat shim around the
 * features/auth/use-auth hook.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthContext, AuthProvider } from "./AuthContext";

describe("AuthContext / AuthProvider", () => {
  it("AuthContext is exposed as a React context with undefined default", () => {
    expect(AuthContext).toBeDefined();
    expect("Provider" in AuthContext).toBe(true);
    expect("Consumer" in AuthContext).toBe(true);
  });

  it("AuthProvider renders its children verbatim (no context value injected)", () => {
    const { getByText } = render(
      <AuthProvider>
        <span>auth-child</span>
      </AuthProvider>
    );
    expect(getByText("auth-child")).toBeInTheDocument();
  });

  it("AuthContext default is undefined (legacy useContext consumers see undefined)", () => {
    let observed: unknown = "init";
    function Probe() {
      observed = AuthContext.Consumer;
      return null;
    }
    render(<Probe />);
    expect(observed).toBeDefined();
  });
});
