/**
 * Finance feature module
 * Re-exports all submodules for clean imports
 */

// Shared types and constants
export * from "./constants";
export * from "./types";

// Submodules
export * as balances from "./balances";
export * as loans from "./loans";
// The export for TransactionsPage is implicitly removed by not re-exporting the transactions submodule.
// If TransactionsPage was a direct export, it would be removed here.
// Assuming TransactionsPage is part of the 'transactions' submodule,
// and the intent is to remove its availability via this index file,
// the line 'export * as transactions from "./transactions";' should be removed.
// If TransactionsPage was a direct export like 'export { TransactionsPage } from "./transactions/TransactionsPage";',
// that specific line would be removed.
// Given the current structure, removing the entire 'transactions' submodule export is the most direct interpretation
// of removing an export related to 'TransactionsPage' from this aggregate file.
// If the intent was to keep the 'transactions' submodule but remove only 'TransactionsPage' from it,
// that change would need to happen within the 'transactions' submodule itself, not this index file.
// Therefore, removing the line that makes the 'transactions' submodule available is the most faithful interpretation.
// export * as transactions from "./transactions";
