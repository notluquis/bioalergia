import { queryOptions } from "@tanstack/react-query";
import { certificatesORPCClient } from "./orpc";

export const certificatesKeys = {
  all: ["certificates"] as const,
  medicalLists: () => [...certificatesKeys.all, "medical", "list"] as const,
  medicalList: (params?: { limit?: number; search?: string; from?: string; to?: string }) =>
    queryOptions({
      queryKey: [...certificatesKeys.medicalLists(), params ?? {}] as const,
      queryFn: () => certificatesORPCClient.listMedical(params ?? {}),
    }),
};
