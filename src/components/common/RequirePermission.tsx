import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAbility } from "@/lib/authz/AbilityProvider";
import { LOADING_SPINNER_MD } from "@/lib/styles";
import Alert from "@/components/ui/Alert";

interface RequirePermissionProps {
  children: React.ReactNode;
  action: string;
  subject: string;
}

export default function RequirePermission({ children, action, subject }: RequirePermissionProps) {
  const { user, initializing } = useAuth();
  const ability = useAbility();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="from-base-200/70 via-base-100 to-base-100 text-base-content flex min-h-screen items-center justify-center bg-linear-to-br">
        <div className="surface-elevated flex items-center gap-4 px-6 py-4 text-sm">
          <span className={LOADING_SPINNER_MD} aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Verificando permisos…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (ability.cannot(action, subject)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <Alert variant="error">
            <div className="space-y-1">
              <p className="font-bold">Acceso Denegado</p>
              <p className="text-xs opacity-90">
                No tienes permisos para realizar la acción{" "}
                <span className="bg-error/20 rounded px-1 font-mono">{action}</span> sobre{" "}
                <span className="bg-error/20 rounded px-1 font-mono">{subject}</span>.
              </p>
            </div>
          </Alert>
          <div className="mt-4 flex justify-center">
            <button onClick={() => window.history.back()} className="btn btn-sm btn-ghost">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
