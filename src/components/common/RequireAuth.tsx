import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-base-200/70 via-base-100 to-base-100 text-base-content">
        <div className="surface-elevated flex items-center gap-4 px-6 py-4 text-sm">
          <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Preparando tu panel seguro…</p>
            <p className="text-xs text-base-content/70">Validando credenciales y sincronizando últimos datos.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
