import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDteXml, fetchDteXmlByPeriod } from "../api";
import { dteAnalyticsKeys } from "../queries";

export function useFetchDteXml() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { dteIds: string[]; direction: "purchases" | "sales" }) =>
      fetchDteXml(params.dteIds, params.direction),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dte-analytics"] });
    },
  });
}

export function useFetchDteXmlByPeriod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      period: string;
      direction: "purchases" | "sales";
      onlyMissing?: boolean;
    }) => fetchDteXmlByPeriod(params.period, params.direction, params.onlyMissing),
    onSuccess: () => {
      // Start polling for job status
      void queryClient.invalidateQueries({ queryKey: ["dte-analytics", "xml-job-status"] });
    },
  });
}

export function useDteXmlJobStatus(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...dteAnalyticsKeys.xmlJobStatus(),
    enabled,
  });

  const isRunning = query.data?.status === "pending" || query.data?.status === "running";
  const isTerminal =
    query.data?.status === "completed" ||
    query.data?.status === "failed" ||
    query.data?.status === "cancelled";

  // Invalidate DTE data when job completes
  if (isTerminal && query.data) {
    void queryClient.invalidateQueries({ queryKey: ["dte-analytics", "sales"] });
    void queryClient.invalidateQueries({ queryKey: ["dte-analytics", "purchases"] });
  }

  return { ...query, isRunning, isTerminal };
}
