import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
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

  const invalidatedJobRef = useRef<null | string>(null);

  useEffect(() => {
    if (!isTerminal || !query.data?.id) return;
    if (invalidatedJobRef.current === query.data.id) return;
    invalidatedJobRef.current = query.data.id;

    // Refresh all DTE data (details tables + line items)
    void queryClient.invalidateQueries({ queryKey: ["dte-analytics"] });
  }, [isTerminal, query.data?.id, queryClient]);

  return { ...query, isRunning, isTerminal };
}
