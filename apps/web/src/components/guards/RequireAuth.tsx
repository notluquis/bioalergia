import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/AuthContext";
import { LOADING_SPINNER_MD } from "@/lib/styles";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing, logout } = useAuth();
  const location = useLocation();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (initializing) {
      timer = setTimeout(() => setShowTimeout(true), 5000); // 5s timeout warning
    } else {
      setShowTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [initializing]);

  if (initializing) {
    return (
      <div className="from-base-200/70 via-base-100 to-base-100 text-base-content flex min-h-screen items-center justify-center bg-linear-to-br">
        <div className="surface-elevated flex flex-col items-center gap-6 p-8 shadow-xl">
          <div className="flex items-center gap-4">
            <span className={LOADING_SPINNER_MD} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Preparando tu panel seguro…</p>
              <p className="text-base-content/70 text-xs">Validando credenciales y sincronizando últimos datos.</p>
            </div>
          </div>

          {showTimeout && (
            <div className="fade-in bg-warning/10 text-warning-content mt-2 flex flex-col items-center gap-2 rounded-lg p-3 text-sm">
              <p>Esto está tardando más de lo usual.</p>
              <div className="flex gap-2">
                <button onClick={() => window.location.reload()} className="btn btn-sm btn-outline">
                  Recargar
                </button>
                <button onClick={() => logout().then(() => window.location.reload())} className="btn btn-sm btn-ghost">
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
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
