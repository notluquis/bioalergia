// src/lib/authz/AbilityProvider.tsx
import { createContext } from "react";
import { createContextualCan } from "@casl/react";
import { ability } from "./ability";
import { Ability } from "@casl/ability";

export const AbilityContext = createContext<Ability>(ability);
export const Can = createContextualCan(AbilityContext.Consumer);

export const AbilityProvider = ({ children }: { children: React.ReactNode }) => {
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};
