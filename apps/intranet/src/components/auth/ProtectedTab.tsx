import { Alert } from "@heroui/react";
import type { ReactNode } from "react";

import { useCan } from "@/hooks/use-can";

/**
 * Per-tab RBAC gate for tabbed pages.
 *
 * The parent route's `beforeLoad` already enforces the LOOSEST permission
 * across all tabs (typically `read` on the parent subject). Each tab
 * panel then wraps its content in `<ProtectedTab>` for the tab's specific
 * subject — so a user with read-only access sees the inbox tab and a
 * polite "no permission" message on the admin-only tabs, instead of the
 * tab disappearing entirely (which would break deep links).
 *
 * Renders a HeroUI v3 `Alert` fallback by default; pass `fallback` to
 * override (e.g. a full empty-state with a contact-admin CTA).
 */
export interface ProtectedTabProps {
  action: string;
  subject: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedTab({ action, subject, children, fallback }: ProtectedTabProps) {
  const { can } = useCan();
  if (can(action, subject)) {
    return <>{children}</>;
  }
  if (fallback !== undefined) {
    return <>{fallback}</>;
  }
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Sin permisos</Alert.Title>
        <Alert.Description>
          Tu rol no incluye acceso a esta sección. Contacta a un administrador si necesitas
          habilitarla.
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
