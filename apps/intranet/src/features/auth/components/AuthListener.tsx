import { useEffect } from "react";
import { updateAbility } from "@/lib/authz/ability";
import { useAuth } from "../hooks/use-auth";

/**
 * Component responsible for synchronizing Auth State with Side Effects (CASL Ability).
 * Should be mounted once at the root of the application (inside QueryClientProvider).
 */
export function AuthListener() {
  const { sessionData, impersonatedRole } = useAuth();

  useEffect(() => {
    if (impersonatedRole) {
      // Build rules from the role
      const rules = impersonatedRole.permissions.map((rp) => ({
        action: rp.permission.action,
        subject: rp.permission.subject,
      }));
      updateAbility(rules);
    } else if (sessionData) {
      updateAbility(sessionData.abilityRules ?? []);
    } else {
      updateAbility([]);
    }
  }, [impersonatedRole, sessionData]);

  return null;
}
