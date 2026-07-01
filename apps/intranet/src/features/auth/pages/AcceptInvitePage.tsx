import { Card } from "@heroui/react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { acceptInvite } from "../api";
import { useAuth } from "../hooks/use-auth";

// Landing for the admin invite email link. Consumes the single-use token
// (starts a PENDING_SETUP session on the server), refreshes the client session,
// then drops the invitee into the onboarding wizard where they set their
// password + profile + bank + MFA.
export function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(!token);
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) {
      return;
    }
    ran.current = true;
    void (async () => {
      try {
        await acceptInvite(token);
        await refreshSession();
        await navigate({ replace: true, to: "/onboarding" });
      } catch {
        setFailed(true);
      }
    })();
  }, [token, refreshSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <Card className="w-full max-w-sm border-none shadow-md">
        <Card.Header>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-primary">
            <KeyRound size={18} /> Activar cuenta
          </h1>
        </Card.Header>
        <Card.Content className="space-y-4 p-5 text-sm">
          {failed ? (
            <>
              <p>La invitación no es válida o expiró.</p>
              <p className="text-default-600">
                Pide a un administrador que te reenvíe la invitación, o usa{" "}
                <Link to="/forgot-password" className="text-primary">
                  recuperar contraseña
                </Link>{" "}
                si ya tienes cuenta.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-default-600">
              <Loader2 className="size-4 animate-spin" /> Activando tu cuenta…
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
