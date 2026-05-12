// Transitional escape hatch for prune-safe clients that are not yet contract-first.
// Replace per feature with ContractRouterClient<typeof contract>.
// oxlint-disable-next-line no-explicit-any
export type UnsafeORPCClient = any;
