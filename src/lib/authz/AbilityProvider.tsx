// src/lib/authz/AbilityProvider.tsx
import React, { createContext } from "react";
import { createContextualCan } from "@casl/react";
import { ability } from "./ability";
import { Ability } from "@casl/ability";

export const AbilityContext = createContext<Ability>(ability);
export const Can = createContextualCan(AbilityContext.Consumer);

export const AbilityProvider = ({ children }: { children: React.ReactNode }) => {
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};

export const useAbility = () => React.useContext(AbilityContext);
