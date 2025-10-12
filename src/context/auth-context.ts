import { createContext, useContext } from "react";

export type UserRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  name: string | null;
};

export type AuthContextType = {
  user: AuthUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider.");
  }
  return ctx;
}
