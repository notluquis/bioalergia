import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-100 text-base-content">
        Comprobando sesión...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
