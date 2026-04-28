import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDteXml, fetchDteXmlByPeriod } from "../api";

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
      void queryClient.invalidateQueries({ queryKey: ["dte-analytics"] });
    },
  });
}
