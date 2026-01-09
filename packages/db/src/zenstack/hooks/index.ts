/* eslint-disable */
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { schema } from "../schema-lite.js";

/**
 * Static Hook Wrappers for ZenStack Models.
 *
 * These wrappers encapsulate the "dynamic" nature of useClientQueries
 * (which returns an object of hooks) into static, exported functions.
 * This satisfies strict linting rules like react-compiler and react-hooks/rules-of-hooks
 * which expect hooks to be static imports, not object properties.
 */

// User & Auth
export function useFindManyUser(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["user"]["useFindMany"]
  >
) {
  const { user } = useClientQueries(schema);
  return user.useFindMany(...args);
}

export function useCreateUser(
  ...args: Parameters<ReturnType<typeof useClientQueries>["user"]["useCreate"]>
) {
  const { user } = useClientQueries(schema);
  return user.useCreate(...args);
}

export function useUpdateUser(
  ...args: Parameters<ReturnType<typeof useClientQueries>["user"]["useUpdate"]>
) {
  const { user } = useClientQueries(schema);
  return user.useUpdate(...args);
}

export function useDeleteUser(
  ...args: Parameters<ReturnType<typeof useClientQueries>["user"]["useDelete"]>
) {
  const { user } = useClientQueries(schema);
  return user.useDelete(...args);
}

export function useFindManyRole(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["role"]["useFindMany"]
  >
) {
  const { role } = useClientQueries(schema);
  return role.useFindMany(...args);
}

// Finance
export function useFindManyTransaction(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["transaction"]["useFindMany"]
  >
) {
  const { transaction } = useClientQueries(schema);
  return transaction.useFindMany(...args);
}

export function useCountTransaction(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["transaction"]["useCount"]
  >
) {
  const { transaction } = useClientQueries(schema);
  return transaction.useCount(...args);
}

export function useFindManySettlementTransaction(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["settlementTransaction"]["useFindMany"]
  >
) {
  const { settlementTransaction } = useClientQueries(schema);
  return settlementTransaction.useFindMany(...args);
}

export function useFindManyReleaseTransaction(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["releaseTransaction"]["useFindMany"]
  >
) {
  const { releaseTransaction } = useClientQueries(schema);
  return releaseTransaction.useFindMany(...args);
}

export function useFindManyLoan(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["loan"]["useFindMany"]
  >
) {
  const { loan } = useClientQueries(schema);
  return loan.useFindMany(...args);
}

export function useFindUniqueLoan(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["loan"]["useFindUnique"]
  >
) {
  const { loan } = useClientQueries(schema);
  return loan.useFindUnique(...args);
}

export function useCreateLoan(
  ...args: Parameters<ReturnType<typeof useClientQueries>["loan"]["useCreate"]>
) {
  const { loan } = useClientQueries(schema);
  return loan.useCreate(...args);
}

export function useFindManyLoanSchedule(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["loanSchedule"]["useFindMany"]
  >
) {
  const { loanSchedule } = useClientQueries(schema);
  return loanSchedule.useFindMany(...args);
}
export function useUpdateLoanSchedule(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["loanSchedule"]["useUpdate"]
  >
) {
  const { loanSchedule } = useClientQueries(schema);
  return loanSchedule.useUpdate(...args);
}

// HR
export function useFindManyEmployee(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["employee"]["useFindMany"]
  >
) {
  const { employee } = useClientQueries(schema);
  return employee.useFindMany(...args);
}

export function useUpdateEmployee(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["employee"]["useUpdate"]
  >
) {
  const { employee } = useClientQueries(schema);
  return employee.useUpdate(...args);
}

export function useCreateEmployee(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["employee"]["useCreate"]
  >
) {
  const { employee } = useClientQueries(schema);
  return employee.useCreate(...args);
}

// Inventory
export function useFindManyInventoryCategory(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryCategory"]["useFindMany"]
  >
) {
  const { inventoryCategory } = useClientQueries(schema);
  return inventoryCategory.useFindMany(...args);
}

export function useCreateInventoryCategory(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryCategory"]["useCreate"]
  >
) {
  const { inventoryCategory } = useClientQueries(schema);
  return inventoryCategory.useCreate(...args);
}

export function useFindManyInventoryItem(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryItem"]["useFindMany"]
  >
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useFindMany(...args);
}

export function useCreateInventoryItem(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryItem"]["useCreate"]
  >
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useCreate(...args);
}

export function useUpdateInventoryItem(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryItem"]["useUpdate"]
  >
) {
  const { inventoryItem } = useClientQueries(schema);
  return inventoryItem.useUpdate(...args);
}

export function useCreateInventoryMovement(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["inventoryMovement"]["useCreate"]
  >
) {
  const { inventoryMovement } = useClientQueries(schema);
  return inventoryMovement.useCreate(...args);
}

export function useFindManySupplyRequest(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["supplyRequest"]["useFindMany"]
  >
) {
  const { supplyRequest } = useClientQueries(schema);
  return supplyRequest.useFindMany(...args);
}

export function useUpdateSupplyRequest(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["supplyRequest"]["useUpdate"]
  >
) {
  const { supplyRequest } = useClientQueries(schema);
  return supplyRequest.useUpdate(...args);
}

export function useFindManyCommonSupply(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["commonSupply"]["useFindMany"]
  >
) {
  const { commonSupply } = useClientQueries(schema);
  return commonSupply.useFindMany(...args);
}

// Services
export function useFindManyService(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["service"]["useFindMany"]
  >
) {
  const { service } = useClientQueries(schema);
  return service.useFindMany(...args);
}

export function useFindUniqueService(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["service"]["useFindUnique"]
  >
) {
  const { service } = useClientQueries(schema);
  return service.useFindUnique(...args);
}

export function useUpdateService(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["service"]["useUpdate"]
  >
) {
  const { service } = useClientQueries(schema);
  return service.useUpdate(...args);
}

// Counterparts & Audit
export function useFindManyCounterpart(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["counterpart"]["useFindMany"]
  >
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useFindMany(...args);
}

export function useCreateCounterpart(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["counterpart"]["useCreate"]
  >
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useCreate(...args);
}

export function useUpdateCounterpart(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["counterpart"]["useUpdate"]
  >
) {
  const { counterpart } = useClientQueries(schema);
  return counterpart.useUpdate(...args);
}

export function useFindManyAuditLog(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["auditLog"]["useFindMany"]
  >
) {
  const { auditLog } = useClientQueries(schema);
  return auditLog.useFindMany(...args);
}

// Sync Logs
export function useFindManySyncLog(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["syncLog"]["useFindMany"]
  >
) {
  const { syncLog } = useClientQueries(schema);
  return syncLog.useFindMany(...args);
}

export function useFindManyCalendarSyncLog(
  ...args: Parameters<
    ReturnType<typeof useClientQueries>["calendarSyncLog"]["useFindMany"]
  >
) {
  const { calendarSyncLog } = useClientQueries(schema);
  return calendarSyncLog.useFindMany(...args);
}

export function useFindManySettlementTransaction(...args: any[]) {
  const { settlementTransaction } = useClientQueries(schema);
  return settlementTransaction.useFindMany(...args);
}

export function useFindManyReleaseTransaction(...args: any[]) {
  const { releaseTransaction } = useClientQueries(schema);
  return releaseTransaction.useFindMany(...args);
}
