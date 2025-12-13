import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCan } from "@/hooks/useCan";

type RequirePermissionProps = {
  children: React.ReactNode;
  action: string;
  subject: string;
};

export default function RequirePermission({ children, action, subject }: RequirePermissionProps) {
  const { can } = useCan();
  const location = useLocation();

  if (!can(action, subject)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
