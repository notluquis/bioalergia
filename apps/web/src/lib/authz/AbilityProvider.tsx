// src/lib/authz/AbilityProvider.tsx
/* eslint-disable sonarjs/deprecation */
import { Ability } from "@casl/ability";
import { createContextualCan } from "@casl/react";
import React, { createContext } from "react";

import { ability } from "./ability";

export const AbilityContext = createContext<Ability>(ability);
export const Can = createContextualCan(AbilityContext.Consumer);

export const AbilityProvider = ({ children }: { children: React.ReactNode }) => {
  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
};

export const useAbility = () => React.useContext(AbilityContext);
