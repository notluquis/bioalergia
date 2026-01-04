/**
 * ZenStack API Client
 *
 * Type-safe hooks for ZenStack v3 Query-as-a-Service endpoints.
 * Uses the RPC API pattern with endpoints like /api/[model]/[operation]
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// API endpoint for ZenStack Query-as-a-Service
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Generic fetch helper for ZenStack RPC API
 */
async function zenFetch<T>(model: string, operation: string, args?: Record<string, unknown>): Promise<T> {
  const url = `${API_BASE_URL}/api/${model}/${operation}`;

  const isWrite = ["create", "update", "delete", "upsert"].some((op) => operation.toLowerCase().includes(op));

  const response = await fetch(url, {
    method: isWrite ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...(args && isWrite && { body: JSON.stringify(args) }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Model-specific hooks factory
 *
 * @example
 * const { useFindMany, useCreate } = createModelHooks('transaction')
 * const { data } = useFindMany({ where: { userId: 1 } })
 */
export function createModelHooks<T>(model: string) {
  return {
    useFindMany: (args?: Record<string, unknown>) =>
      useQuery({
        queryKey: [model, "findMany", args],
        queryFn: () => zenFetch<T[]>(model, "findMany", args),
      }),

    useFindUnique: (args: { where: Record<string, unknown> }) =>
      useQuery({
        queryKey: [model, "findUnique", args],
        queryFn: () => zenFetch<T | null>(model, "findUnique", args),
      }),

    useCreate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (data: Record<string, unknown>) => zenFetch<T>(model, "create", { data }),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [model] });
        },
      });
    },

    useUpdate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
          zenFetch<T>(model, "update", args),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [model] });
        },
      });
    },

    useDelete: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (args: { where: Record<string, unknown> }) => zenFetch<T>(model, "delete", args),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [model] });
        },
      });
    },
  };
}

// Pre-built hooks for common models
export const transactionHooks = createModelHooks("transaction");
export const userHooks = createModelHooks("user");
export const personHooks = createModelHooks("person");
export const roleHooks = createModelHooks("role");
