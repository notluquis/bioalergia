import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { outreachORPCClient } from "../orpc";

type ListInput = Parameters<typeof outreachORPCClient.listEstablishments>[0];
type Bulk = Parameters<typeof outreachORPCClient.bulkUpdateEstablishments>[0];
type Update = Parameters<typeof outreachORPCClient.updateEstablishment>[0];
type Upsert = Parameters<typeof outreachORPCClient.upsertContact>[0];
type Create = Parameters<typeof outreachORPCClient.createInteraction>[0];
type Record_ = Parameters<typeof outreachORPCClient.recordDeliveryResult>[0];
type Preview = Parameters<typeof outreachORPCClient.previewCampaign>[0];
type CampaignCreate = Parameters<typeof outreachORPCClient.createCampaign>[0];
type CampaignUpdate = Parameters<typeof outreachORPCClient.updateCampaign>[0];
type ImportInput = Parameters<typeof outreachORPCClient.importMineduc>[0];

const BASE_KEY = ["outreach"] as const;

export function useDashboard() {
  return useQuery({
    queryKey: [...BASE_KEY, "dashboard"],
    queryFn: () => outreachORPCClient.dashboard({}),
  });
}

export function useFiltersMeta() {
  return useQuery({
    queryKey: [...BASE_KEY, "filters"],
    queryFn: () => outreachORPCClient.filtersMeta({}),
  });
}

export function useEstablishments(input: Partial<ListInput>) {
  const params = {
    page: input.page ?? 1,
    pageSize: input.pageSize ?? 50,
    sortBy: input.sortBy ?? "nombre",
    sortDir: input.sortDir ?? "asc",
    search: input.search,
    estados: input.estados,
    dependencias: input.dependencias,
    comunas: input.comunas,
    prioridades: input.prioridades,
    soloConEmail: input.soloConEmail,
    soloActivos: input.soloActivos,
  } as ListInput;
  return useQuery({
    queryKey: [...BASE_KEY, "establishments", params],
    queryFn: () => outreachORPCClient.listEstablishments(params),
  });
}

export function useEstablishment(rbd: string | undefined) {
  return useQuery({
    queryKey: [...BASE_KEY, "establishment", rbd],
    enabled: Boolean(rbd),
    queryFn: () => outreachORPCClient.getEstablishment({ rbd: rbd! }),
  });
}

export function useUpdateEstablishment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Update) => outreachORPCClient.updateEstablishment(input as Update),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment", vars.rbd] });
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishments"] });
    },
  });
}

export function useBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Bulk) => outreachORPCClient.bulkUpdateEstablishments(input as Bulk),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishments"] });
    },
  });
}

export function useUpsertContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Upsert) => outreachORPCClient.upsertContact(input as Upsert),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: [...BASE_KEY, "establishment", vars.establecimientoRbd],
      });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => outreachORPCClient.deleteContact({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment"] }),
  });
}

export function useCreateInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Create) => outreachORPCClient.createInteraction(input as Create),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({
        queryKey: [...BASE_KEY, "establishment", vars.establecimientoRbd],
      });
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "dashboard"] });
    },
  });
}

export function useDeleteInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => outreachORPCClient.deleteInteraction({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment"] }),
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: [...BASE_KEY, "campaigns"],
    queryFn: () => outreachORPCClient.listCampaigns({}),
  });
}

export function useCampaign(id: number | undefined) {
  return useQuery({
    queryKey: [...BASE_KEY, "campaign", id],
    enabled: Boolean(id),
    queryFn: () => outreachORPCClient.getCampaign({ id: id! }),
    refetchInterval: 5000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignCreate) => outreachORPCClient.createCampaign(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignUpdate) => outreachORPCClient.updateCampaign(input),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaign", vars.id] });
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaigns"] });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => outreachORPCClient.deleteCampaign({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaigns"] }),
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => outreachORPCClient.launchCampaign({ id }),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaign", id] });
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaigns"] });
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => outreachORPCClient.pauseCampaign({ id }),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "campaign", id] });
    },
  });
}

export function usePreviewCampaign() {
  return useMutation({
    mutationFn: (input: Preview) => outreachORPCClient.previewCampaign(input as Preview),
  });
}

export function useImportMineduc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportInput) => outreachORPCClient.importMineduc(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: BASE_KEY }),
  });
}

export function useZonas() {
  return useQuery({
    queryKey: [...BASE_KEY, "zonas"],
    queryFn: () => outreachORPCClient.zonas({}),
  });
}

export function useDiscoverGooglePlaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof outreachORPCClient.discoverGooglePlaces>[0]) =>
      outreachORPCClient.discoverGooglePlaces(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishments"] });
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "dashboard"] });
    },
  });
}

export function useCrawlProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rbd: string) => outreachORPCClient.crawlProspect({ rbd }),
    onSuccess: (_, rbd) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment", rbd] });
    },
  });
}

export function useApolloEnrich() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rbd: string) => outreachORPCClient.apolloEnrich({ rbd }),
    onSuccess: (_, rbd) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment", rbd] });
    },
  });
}

export function useHunterDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rbd: string) => outreachORPCClient.hunterDomain({ rbd }),
    onSuccess: (_, rbd) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment", rbd] });
    },
  });
}

export function useHunterVerify() {
  return useMutation({
    mutationFn: (email: string) => outreachORPCClient.hunterVerifyEmail({ email }),
  });
}

export function useRecomputeScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rbd: string) => outreachORPCClient.recomputeScore({ rbd }),
    onSuccess: (_, rbd) => {
      void qc.invalidateQueries({ queryKey: [...BASE_KEY, "establishment", rbd] });
    },
  });
}

export function useBulkCrawl() {
  return useMutation({
    mutationFn: (input: Parameters<typeof outreachORPCClient.bulkCrawl>[0]) =>
      outreachORPCClient.bulkCrawl(input),
  });
}

export function useBulkCrawlStatus(jobId: string | null) {
  return useQuery({
    queryKey: [...BASE_KEY, "bulk-crawl-status", jobId],
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const data = q.state.data as
        | { status: "pending" | "running" | "completed" | "failed" }
        | undefined;
      if (!data) return 1500;
      if (data.status === "running" || data.status === "pending") return 1500;
      return false;
    },
    queryFn: () => outreachORPCClient.bulkCrawlStatus({ jobId: jobId! }),
  });
}

export function useNextDeliveryBatch() {
  return useMutation({
    mutationFn: (input: { campaignId: number; limit: number }) =>
      outreachORPCClient.nextDeliveryBatch(input),
  });
}

export function useRecordDeliveryResult() {
  return useMutation({
    mutationFn: (input: Record_) => outreachORPCClient.recordDeliveryResult(input as Record_),
  });
}
