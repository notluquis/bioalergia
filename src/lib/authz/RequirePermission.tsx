// src/lib/authz/RequirePermission.tsx
import React from "react";
import { useCan } from "@/hooks/useCan";

interface RequirePermissionProps {
  I: string;
  a: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({ I, a, children, fallback = null }) => {
  const { can } = useCan();
  return can(I, a) ? <>{children}</> : <>{fallback}</>;
};
