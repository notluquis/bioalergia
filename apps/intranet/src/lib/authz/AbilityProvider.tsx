// src/lib/authz/AbilityProvider.tsx
//
// @casl/react v7: the library ships its own AbilityProvider (context-backed),
// Can, and useAbility. We expose a no-arg wrapper that feeds the app-wide
// singleton `ability` so call sites stay `<AbilityProvider>…</AbilityProvider>`.

import { AbilityProvider as CaslAbilityProvider, Can, useAbility } from "@casl/react";
import type { ReactNode } from "react";

import { ability } from "./ability";

export const AbilityProvider = ({ children }: { children: ReactNode }) => {
  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
};

// Re-exported for consumers that want the canonical v7 primitives.
export { Can, useAbility };
