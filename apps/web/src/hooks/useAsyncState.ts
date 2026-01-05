import { useState } from "react";

/**
 * Hook reutilizable para manejar estado asíncrono común (loading, error, data).
 * Simplifica el patrón repetitivo de useState para loading y error en llamadas async.
 *
 * @example
 * ```tsx
 * const { data, loading, error, setData, setLoading, setError, clearError } = useAsyncState<User[]>([]);
 *
 * async function fetchUsers() {
 *   setLoading(true);
 *   clearError();
 *   try {
 *     const users = await apiClient.get('/api/users');
 *     setData(users);
 *   } catch (err) {
 *     setError(err instanceof Error ? err.message : 'Error desconocido');
 *   } finally {
 *     setLoading(false);
 *   }
 * }
 * ```
 */
export function useAsyncState<T>(initialData?: T) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const reset = () => {
    setData(initialData);
    setLoading(false);
    setError(null);
  };

  return {
    data,
    loading,
    error,
    setData,
    setLoading,
    setError,
    clearError,
    reset,
  };
}
