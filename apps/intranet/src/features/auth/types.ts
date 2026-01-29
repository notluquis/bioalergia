import type { MongoAbility, RawRuleOf } from "@casl/ability";

export interface AuthUser {
  email: string;
  hasPasskey?: boolean;
  id: number;
  mfaEnabled?: boolean;
  mfaEnforced?: boolean;
  name: null | string;
  roles: string[];
  status: string;
}

export type LoginResult =
  | { status: "mfa_required"; userId: number }
  | { status: "ok"; user: AuthUser };

export interface AuthSessionData {
  abilityRules: null | RawRuleOf<MongoAbility>[];
  permissionVersion: null | number;
  user: AuthUser | null;
}
