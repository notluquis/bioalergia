/**
 * Static Hook Wrappers for ZenStack Models.
 *
 * These wrappers encapsulate the "dynamic" nature of useClientQueries
 * (which returns an object of hooks) into static, exported functions.
 * This satisfies strict linting rules like react-compiler and react-hooks/rules-of-hooks
 * which expect hooks to be static imports, not object properties.
 */
import {
  useClientQueries,
  type ClientHooks,
} from "@zenstackhq/tanstack-query/react";
import { schema, type SchemaType } from "../schema-lite.js";

// Create a typed helper type for extracting hook parameters
type Hooks = ClientHooks<SchemaType>;

// User & Auth
export function useFindManyUser(
  ...args: Parameters<Hooks["user"]["useFindMany"]>
) {
  const { user } = useClientQueries(schema);
  return user.useFindMany(...args);
}

export function useCreateUser(...args: Parameters<Hooks["user"]["useCreate"]>) {
  const { user } = useClientQueries(schema);
  return user.useCreate(...args);
}

export function useUpdateUser(...args: Parameters<Hooks["user"]["useUpdate"]>) {
  const { user } = useClientQueries(schema);
  return user.useUpdate(...args);
}

export function useDeleteUser(...args: Parameters<Hooks["user"]["useDelete"]>) {
  const { user } = useClientQueries(schema);
  return user.useDelete(...args);
}

export function useFindManyRole(
  ...args: Parameters<Hooks["role"]["useFindMany"]>
) {
  const { role } = useClientQueries(schema);
  return role.useFindMany(...args);
}

// UserRoleAssignment (for role management)
export function useCreateUserRoleAssignment(
  ...args: Parameters<Hooks["userRoleAssignment"]["useCreate"]>
) {
  const { userRoleAssignment } = useClientQueries(schema);
  return userRoleAssignment.useCreate(...args);
}

export function useDeleteManyUserRoleAssignment(
  ...args: Parameters<Hooks["userRoleAssignment"]["useDeleteMany"]>
) {
  const { userRoleAssignment } = useClientQueries(schema);
  return userRoleAssignment.useDeleteMany(...args);
}

// Finance
export function useFindManyTransaction(
  ...args: Parameters<Hooks["transaction"]["useFindMany"]>
) {
  const { transaction } = useClientQueries(schema);
  return transaction.useFindMany(...args);
}

export function useCountTransaction(
  ...args: Parameters<Hooks["transaction"]["useCount"]>
) {
  const { transaction } = useClientQueries(schema);
  return transaction.useCount(...args);
}

export function useFindManySettlementTransaction(
  ...args: Parameters<Hooks["settlementTransaction"]["useFindMany"]>
) {
  const { settlementTransaction } = useClientQueries(schema);
  return settlementTransaction.useFindMany(...args);
}

export function useFindManyReleaseTransaction(
  ...args: Parameters<Hooks["releaseTransaction"]["useFindMany"]>
) {
  const { releaseTransaction } = useClientQueries(schema);
  return releaseTransaction.useFindMany(...args);
}

export function useFindManyLoan(
  ...args: Parameters<Hooks["loan"]["useFindMany"]>
) {
  const { loan } = useClientQueries(schema);
  return loan.useFindMany(...args);
}

export function useFindUniqueLoan(
  ...args: Parameters<Hooks["loan"]["useFindUnique"]>
) {
  const { loan } = useClientQueries(schema);
  return loan.useFindUnique(...args);
}

export function useCreateLoan(...args: Parameters<Hooks["loan"]["useCreate"]>) {
  const { loan } = useClientQueries(schema);
  return loan.useCreate(...args);
}

export function useFindManyLoanSchedule(
  ...args: Parameters<Hooks["loanSchedule"]["useFindMany"]>
) {
  const { loanSchedule } = useClientQueries(schema);
  return loanSchedule.useFindMany(...args);
}

export function useUpdateLoanSchedule(
  ...args: Parameters<Hooks["loanSchedule"]["useUpdate"]>
) {
  const { loanSchedule } = useClientQueries(schema);
  return loanSchedule.useUpdate(...args);
}

// HR
export function useFindManyEmployee(
  ...args: Parameters<Hooks["employee"]["useFindMany"]>
) {
  const { employee } = useClientQueries(schema);
  return employee.useFindMany(...args);
}

export function useUpdateEmployee(
  ...args: Parameters<Hooks["employee"]["useUpdate"]>
) {
  const { employee } = useClientQueries(schema);
  return employee.useUpdate(...args);
}

export function useCreateEmployee(
  ...args: Parameters<Hooks["employee"]["useCreate"]>
) {
  const { employee } = useClientQueries(schema);
  return employee.useCreate(...args);
}

// Inventory
export function useFindManyInventoryCategory(
  ...args: Parameters<Hooks["inventoryCategory"]["useFindMany"]>
) {
  const { inventoryCategory } = useClientQueries(schema);
  return inventoryCategory.useFindMany(...args);
}

export function useCreateInventoryCategory(
  ...args: Parameters<Hooks["inventoryCategory"]["useCreate"]>
) {
  const { inventoryCategory } = useClientQueries(schema);
  return inventoryCategory.useCreate(...args);
}

export function useFindManyInventoryItem(
  ...args: Parameters<Hooks["inventoryItem"]["useFindMany"]>
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useFindMany(...args);
}

export function useCreateInventoryItem(
  ...args: Parameters<Hooks["inventoryItem"]["useCreate"]>
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useCreate(...args);
}

export function useUpdateInventoryItem(
  ...args: Parameters<Hooks["inventoryItem"]["useUpdate"]>
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useUpdate(...args);
}

export function useCreateInventoryMovement(
  ...args: Parameters<Hooks["inventoryMovement"]["useCreate"]>
) {
  const { inventoryMovement } = useClientQueries(schema);
  return inventoryMovement.useCreate(...args);
}

export function useFindManySupplyRequest(
  ...args: Parameters<Hooks["supplyRequest"]["useFindMany"]>
) {
  const { supplyRequest } = useClientQueries(schema);
  return supplyRequest.useFindMany(...args);
}

export function useUpdateSupplyRequest(
  ...args: Parameters<Hooks["supplyRequest"]["useUpdate"]>
) {
  const { supplyRequest } = useClientQueries(schema);
  return supplyRequest.useUpdate(...args);
}

export function useFindManyCommonSupply(
  ...args: Parameters<Hooks["commonSupply"]["useFindMany"]>
) {
  const { commonSupply } = useClientQueries(schema);
  return commonSupply.useFindMany(...args);
}

// Services
export function useFindManyService(
  ...args: Parameters<Hooks["service"]["useFindMany"]>
) {
  const { service } = useClientQueries(schema);
  return service.useFindMany(...args);
}

export function useFindUniqueService(
  ...args: Parameters<Hooks["service"]["useFindUnique"]>
) {
  const { service } = useClientQueries(schema);
  return service.useFindUnique(...args);
}

export function useUpdateService(
  ...args: Parameters<Hooks["service"]["useUpdate"]>
) {
  const { service } = useClientQueries(schema);
  return service.useUpdate(...args);
}

// Counterparts & Audit
export function useFindManyCounterpart(
  ...args: Parameters<Hooks["counterpart"]["useFindMany"]>
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useFindMany(...args);
}

export function useCreateCounterpart(
  ...args: Parameters<Hooks["counterpart"]["useCreate"]>
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useCreate(...args);
}

export function useUpdateCounterpart(
  ...args: Parameters<Hooks["counterpart"]["useUpdate"]>
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useUpdate(...args);
}

export function useFindManyAuditLog(
  ...args: Parameters<Hooks["auditLog"]["useFindMany"]>
) {
  const { auditLog } = useClientQueries(schema);
  return auditLog.useFindMany(...args);
}

// Sync Logs
export function useFindManySyncLog(
  ...args: Parameters<Hooks["syncLog"]["useFindMany"]>
) {
  const { syncLog } = useClientQueries(schema);
  return syncLog.useFindMany(...args);
}

export function useFindManyCalendarSyncLog(
  ...args: Parameters<Hooks["calendarSyncLog"]["useFindMany"]>
) {
  const { calendarSyncLog } = useClientQueries(schema);
  return calendarSyncLog.useFindMany(...args);
}
