import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/ui/PageLoader";

export default function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <PageLoader />;
  }

  if (user) {
    // If user is already logged in, redirect to home or the page they came from
    const from = (location.state as { from?: string } | null)?.from || "/";
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
