import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDteXml } from "../api";

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
