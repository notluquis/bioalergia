// server/lib/authz/permissionMap.ts

import { readonly } from "../readonly.js";

/**
 * Maps a permission key (e.g., 'user.create') to a CASL action and subject.
 * This provides a single source of truth for permission definitions.
 */
export const permissionMap = readonly({
  "user.create": { action: "create", subject: "User" },
  "user.read": { action: "read", subject: "User" },
  "user.update": { action: "update", subject: "User" },
  "user.delete": { action: "delete", subject: "User" },

  "transaction.create": { action: "create", subject: "Transaction" },
  "transaction.read": { action: "read", subject: "Transaction" },
  "transaction.update": { action: "update", subject: "Transaction" },
  "transaction.delete": { action: "delete", subject: "Transaction" },

  "setting.manage": { action: "manage", subject: "Setting" },

  // Add other permissions here
} as const);

export type PermissionKey = keyof typeof permissionMap;
