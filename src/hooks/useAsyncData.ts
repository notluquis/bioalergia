import { useState, useCallback } from "react";

export interface UseAsyncDataState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  total: number;
}

export interface UseAsyncDataOptions<T> {
  initialData?: T[];
  onError?: (error: Error) => void;
}

export function useAsyncData<T>({ initialData = [], onError }: UseAsyncDataOptions<T> = {}) {
  const [state, setState] = useState<UseAsyncDataState<T>>({
    data: initialData,
    loading: false,
    error: null,
    total: 0,
  });

  const loadData = useCallback(
    async (fetchFn: () => Promise<{ data: T[]; total: number }>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await fetchFn();
        setState({
          data: result.data,
          total: result.total,
          loading: false,
          error: null,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : "Error desconocido";
        setState((prev) => ({
          ...prev,
          loading: false,
          error,
        }));

        if (onError) {
          onError(err instanceof Error ? err : new Error(error));
        }
      }
    },
    [onError]
  );

  const setData = useCallback((data: T[]) => {
    setState((prev) => ({ ...prev, data, total: data.length }));
  }, []);

  const addItem = useCallback((item: T) => {
    setState((prev) => ({
      ...prev,
      data: [...prev.data, item],
      total: prev.total + 1,
    }));
  }, []);

  const updateItem = useCallback((index: number, item: T) => {
    setState((prev) => ({
      ...prev,
      data: prev.data.map((d, i) => (i === index ? item : d)),
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      data: prev.data.filter((_, i) => i !== index),
      total: prev.total - 1,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
      total: initialData.length,
    });
  }, [initialData]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    loadData,
    setData,
    addItem,
    updateItem,
    removeItem,
    reset,
    clearError,
  };
}
