import { useAbility } from "@casl/react";

import { AbilityContext } from "../lib/authz/AbilityProvider";

export function useCan() {
  const ability = useAbility(AbilityContext);

  const can = (action: string, subject: string, field?: string) => {
    return ability.can(action, subject, field);
  };

  return { ability, can };
}
