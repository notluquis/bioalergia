import { Button, Card } from "@heroui/react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { acceptInvite } from "../api";
import { useAuth } from "../hooks/use-auth";

// Landing for the admin invite email link. Consumption is behind an explicit
// button press — the token is single-use, so we must NOT burn it on mount (mail
// security crawlers / link-preview bots execute the SPA and would consume it
// before the human sees it). On click it starts a PENDING_SETUP session and
// drops the invitee into the onboarding wizard (password + profile + bank + MFA).
export function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleActivate = async () => {
    if (!token) {
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await acceptInvite(token);
      await refreshSession();
      await navigate({ replace: true, to: "/onboarding" });
    } catch {
      setFailed(true);
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <Card className="w-full max-w-sm border-none shadow-md">
        <Card.Header>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <KeyRound aria-hidden size={18} /> Activar cuenta
          </h1>
        </Card.Header>
        <Card.Content className="space-y-4 p-5 text-sm">
          {token ? (
            <>
              <p className="text-default-600">
                Haz clic para activar tu cuenta y completar tu configuración.
              </p>
              <Button
                className="w-full"
                isDisabled={pending}
                onPress={() => void handleActivate()}
                variant="primary"
              >
                {pending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 aria-hidden className="size-4 animate-spin" /> Activando…
                  </span>
                ) : (
                  "Activar mi cuenta"
                )}
              </Button>
              {failed ? (
                <p className="text-danger-600">
                  La invitación no es válida o expiró. Pide una nueva a un administrador.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-default-600">
              El enlace no es válido o está incompleto. Pide a un administrador que te reenvíe la
              invitación, o usa{" "}
              <Link to="/forgot-password" className="text-primary">
                recuperar contraseña
              </Link>
              .
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
