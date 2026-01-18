import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/apiClient";

export interface JobState {
  error: null | string;
  id: string;
  message: string;
  progress: number;
  result: unknown;
  status: "completed" | "failed" | "pending" | "running";
  total: number;
  type: string;
}

interface UseJobProgressOptions {
  onComplete?: (result: unknown) => void;
  onError?: (error: string) => void;
  /** Polling interval in ms (default: 500) */
  pollInterval?: number;
}

/**
 * Hook to track background job progress via polling.
 * Automatically stops polling when job completes or fails.
 */
export function useJobProgress(jobId: null | string, options: UseJobProgressOptions = {}) {
  const { onComplete, onError, pollInterval = 500 } = options;
  const queryClient = useQueryClient();
  const [hasNotified, setHasNotified] = useState(false);

  const query = useSuspenseQuery({
    queryFn: async () => {
      if (!jobId) return null;
      const response = await apiClient.get<{ job: JobState; status: string }>(`/api/calendar/events/job/${jobId}`);
      if (response.status !== "ok") {
        throw new Error("Failed to fetch job status");
      }
      return response.job;
    },
    queryKey: ["job-status", jobId],

    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when job is done
      if (!data || data.status === "completed" || data.status === "failed") {
        return;
      }
      return pollInterval;
    },
    staleTime: 0, // Always refetch
  });

  // Handle completion/error callbacks
  useEffect(() => {
    if (!query.data || hasNotified) return;

    if (query.data.status === "completed") {
      setHasNotified(true);
      onComplete?.(query.data.result);
      // Invalidate calendar queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["calendar-unclassified"] });
    } else if (query.data.status === "failed" && query.data.error) {
      setHasNotified(true);
      onError?.(query.data.error);
    }
  }, [query.data, hasNotified, onComplete, onError, queryClient]);

  // Reset notification state when jobId changes
  useEffect(() => {
    setHasNotified(false);
  }, [jobId]);

  const reset = () => {
    setHasNotified(false);
  };

  return {
    isComplete: query.data?.status === "completed",
    isFailed: query.data?.status === "failed",
    isPolling: query.isFetching && query.data?.status === "running",
    job: query.data,
    progress: query.data ? Math.round((query.data.progress / query.data.total) * 100) : 0,
    reset,
  };
}
