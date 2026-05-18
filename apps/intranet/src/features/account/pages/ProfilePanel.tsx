import { Alert } from "@heroui/react";
import { AtSign, IdCard, Mail, ShieldCheck, UserRound } from "lucide-react";

import { useAuth } from "@/context/AuthContext";

/**
 * `/account?tab=perfil` panel — read-only identity view of the logged-in
 * user. Edit flow lives in the onboarding wizard
 * (`apps/intranet/src/pages/onboarding/components/ProfileStep.tsx`) and
 * isn't yet exposed as a standalone editor — when that ships it replaces
 * this panel without breaking the URL contract.
 *
 * HeroUI v3 only — no native form elements; tab gating is handled by the
 * parent route via `<ProtectedTab>`.
 */
export function ProfilePanel() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Sin sesión</Alert.Title>
          <Alert.Description>No hay un usuario autenticado en este momento.</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const rows: { icon: typeof UserRound; label: string; value: string }[] = [
    { icon: UserRound, label: "Nombre", value: user.name ?? "Sin nombre" },
    { icon: Mail, label: "Correo de contacto", value: user.email },
    {
      icon: AtSign,
      label: "Correo de inicio de sesión",
      value: user.loginEmail ?? user.email,
    },
    {
      icon: IdCard,
      label: "ID de usuario",
      value: String(user.id),
    },
    {
      icon: ShieldCheck,
      label: "Roles",
      value: user.roles.length > 0 ? user.roles.join(", ") : "Sin roles asignados",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1 px-6 pt-6">
        <h2 className="font-semibold text-lg text-primary drop-shadow-sm">Mi perfil</h2>
        <p className="text-default-600 text-sm">
          Información asociada a tu cuenta. Para modificar tus datos personales, contacta a un
          administrador.
        </p>
      </div>

      <div className="space-y-3 px-6 pb-6">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="flex items-start gap-4 rounded-xl border border-default-200/60 bg-background/70 p-4"
            >
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-default-500 text-xs">{row.label}</p>
                <p className="truncate font-medium text-foreground">{row.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
