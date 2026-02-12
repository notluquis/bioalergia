import type { RawRuleOf } from "@casl/ability";
import { useEffect, useRef } from "react";
import { setNotificationScope } from "@/features/notifications/store/use-notification-store";
import type { AppAbility } from "@/lib/authz/ability";
import { updateAbility } from "@/lib/authz/ability";
import { useAuth } from "../hooks/use-auth";

/**
 * Component responsible for synchronizing Auth State with Side Effects (CASL Ability).
 * Should be mounted once at the root of the application (inside QueryClientProvider).
 */
export function AuthListener() {
  const { sessionData, impersonatedRole } = useAuth();
  const lastRulesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (sessionData === undefined) {
      return;
    }
    setNotificationScope(sessionData?.user?.id ?? null);
  }, [sessionData]);

  useEffect(() => {
    const sessionLoaded = sessionData !== undefined;
    if (!sessionLoaded && !impersonatedRole) {
      return;
    }

    const rules: RawRuleOf<AppAbility>[] = impersonatedRole
      ? impersonatedRole.permissions.map((rp) => ({
          action: rp.permission.action,
          subject: rp.permission.subject,
          conditions: undefined,
        }))
      : (sessionData?.abilityRules ?? []);

    const rulesKey = rules
      .map((rule) => `${rule.action}:${String(rule.subject)}:${JSON.stringify(rule.conditions)}`)
      .join("|");

    if (rulesKey === lastRulesKeyRef.current) {
      return;
    }
    lastRulesKeyRef.current = rulesKey;

    if (impersonatedRole) {
      updateAbility(rules);
    } else if (sessionLoaded && sessionData) {
      updateAbility(rules);
    } else {
      updateAbility([]);
    }
  }, [impersonatedRole, sessionData]);

  return null;
}
