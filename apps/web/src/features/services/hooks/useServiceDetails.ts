import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";

import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";

import { fetchServiceDetail } from "../api";
import { serviceKeys } from "../queries";
import { servicesActions, servicesStore } from "../store";
import type { ServiceDetailResponse, ServiceListResponse } from "../types";

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
    queryKey: [...serviceKeys.detailsAggregated(serviceIds), services.length, canView],
    queryFn: async () => {
      if (services.length === 0 || !canView) return {};
      const results = await Promise.allSettled(services.map((service) => fetchServiceDetail(service.public_id)));

      const detailsMap: Record<string, ServiceDetailResponse> = {};
      const failures: Array<{ id: string; reason: unknown }> = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          detailsMap[result.value.service.public_id] = result.value;
        } else {
          const serviceId = services[index]?.public_id ?? "unknown";
          failures.push({ id: serviceId, reason: result.reason });
          logger.error("[services] aggregated:error", { serviceId, error: result.reason });
        }
      });

      if (failures.length > 0) {
        console.warn(`Failed to load details for ${failures.length} services`);
      }
      return detailsMap;
    },
    staleTime: 5 * 60 * 1000,
  });

  const detail = selectedId && allDetails[selectedId] ? allDetails[selectedId] : null;

  // Sync selectedId (if needed, though store usually drives this)
  useEffect(() => {
    // Legacy behavior synced ref here, but component should be reactive to store
  }, [selectedId]);

  const unifiedAgendaItems = Object.values(allDetails).flatMap((item) =>
    item.schedules.map((schedule) => ({ service: item.service, schedule }))
  );

  return {
    allDetails,
    selectedService: detail?.service ?? null,
    schedules: detail?.schedules ?? [],
    unifiedAgendaItems,
    aggregatedLoading: false, // Suspense guarantees data is ready
    aggregatedError: null, // Errors are handled by Suspense boundary or internally logged

    // Selection / Modal State
    selectedId,
    setSelectedId: servicesActions.setSelectedId,
    createOpen,
    openCreateModal: servicesActions.openCreateModal,
    closeCreateModal: servicesActions.closeCreateModal,
    selectedTemplate,
    setSelectedTemplate: (t: any) => servicesStore.setState((s) => ({ ...s, selectedTemplate: t })),
    applyTemplate: servicesActions.openCreateModal,
  };
}
