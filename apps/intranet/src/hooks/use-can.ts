import { useAbility } from "@casl/react";

export function useCan() {
  // @casl/react v7: useAbility() reads the AbilityProvider context (no arg).
  const ability = useAbility();

  const can = (action: string, subject: string, field?: string) => {
    return ability.can(action, subject, field);
  };

  return { ability, can };
}
