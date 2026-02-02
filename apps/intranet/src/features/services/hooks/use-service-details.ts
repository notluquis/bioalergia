import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { fetchServiceDetail } from "../api";
import { serviceKeys } from "../queries";
import { servicesActions, servicesStore } from "../store";
import type { ServiceDetailResponse, ServiceListResponse, ServiceTemplate } from "../types";

export function useServiceDetails(services: ServiceListResponse["services"]) {
  const { can } = useAuth();
  const canView = can("read", "Service");

  // Store
  const selectedId = useStore(servicesStore, (state) => state.selectedId);
  const selectedTemplate = useStore(servicesStore, (state) => state.selectedTemplate);
  const createOpen = useStore(servicesStore, (state) => state.createOpen);

  const serviceIds = services.map((s) => s.public_id).join(",");

  // Fetch All Details (Aggregated)
  const { data: allDetails } = useSuspenseQuery({
    queryFn: async () => {
      if (services.length === 0 || !canView) return {};
      const results = await Promise.allSettled(
        services.map((service) => fetchServiceDetail(service.public_id)),
      );

      const detailsMap: Record<string, ServiceDetailResponse> = {};
      const failures: { id: string; reason: unknown }[] = [];

      for (const [index, result] of results.entries()) {
        if (result.status === "fulfilled") {
          detailsMap[result.value.service.public_id] = result.value;
        } else {
          const serviceId = services[index]?.public_id ?? "unknown";
          failures.push({ id: serviceId, reason: result.reason });
          logger.error("[services] aggregated:error", { error: result.reason, serviceId });
        }
      }

      if (failures.length > 0) {
        console.warn(`Failed to load details for ${failures.length} services`);
      }
      return detailsMap;
    },
    queryKey: [...serviceKeys.detailsAggregated(serviceIds), services.length, canView],
    staleTime: 5 * 60 * 1000,
  });

  const detail = selectedId && allDetails[selectedId] ? allDetails[selectedId] : null;

  // Sync selectedId (if needed, though store usually drives this)
  useEffect(() => {
    // Legacy behavior synced ref here, but component should be reactive to store
  }, []);

  const unifiedAgendaItems = Object.values(allDetails).flatMap((item) =>
    item.schedules.map((schedule) => ({ schedule, service: item.service })),
  );

  return {
    aggregatedError: null, // Errors are handled by Suspense boundary or internally logged
    aggregatedLoading: false, // Suspense guarantees data is ready
    allDetails,
    applyTemplate: servicesActions.openCreateModal,
    closeCreateModal: servicesActions.closeCreateModal,
    createOpen,

    openCreateModal: servicesActions.openCreateModal,
    schedules: detail?.schedules ?? [],
    // Selection / Modal State
    selectedId,
    selectedService: detail?.service ?? null,
    selectedTemplate,
    setSelectedId: servicesActions.setSelectedId,
    setSelectedTemplate: (t: null | ServiceTemplate) => {
      servicesStore.setState((s) => ({ ...s, selectedTemplate: t }));
    },
    unifiedAgendaItems,
  };
}
