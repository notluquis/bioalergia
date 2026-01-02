import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LOADING_SPINNER_MD } from "@/lib/styles";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="from-base-200/70 via-base-100 to-base-100 text-base-content flex min-h-screen items-center justify-center bg-linear-to-br">
        <div className="surface-elevated flex items-center gap-4 px-6 py-4 text-sm">
          <span className={LOADING_SPINNER_MD} aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Preparando tu panel seguro…</p>
            <p className="text-base-content/70 text-xs">Validando credenciales y sincronizando últimos datos.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Redirect to onboarding if pending setup
  if (user.status === "PENDING_SETUP" && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Prevent access to onboarding if already active
  if (user.status === "ACTIVE" && location.pathname === "/onboarding") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
