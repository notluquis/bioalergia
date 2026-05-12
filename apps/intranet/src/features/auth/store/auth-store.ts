import { createPersistentStore } from "@/lib/store-utils";
import type { Role } from "@/types/roles";

export interface AuthState {
  impersonatedRole: Role | null;
}

export const authStore = createPersistentStore<AuthState>("bioalergia-auth-state", {
  impersonatedRole: null,
});

export const setImpersonatedRole = (role: Role | null) => {
  authStore.setState(() => ({ impersonatedRole: role }));
};
