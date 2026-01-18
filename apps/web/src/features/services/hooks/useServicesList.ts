import { useSuspenseQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";

import { useAuth } from "@/context/AuthContext";

import type { SummaryTotals } from "../types";

import { extractErrorMessage } from "../api";
import { serviceQueries } from "../queries";
import { servicesActions, servicesStore } from "../store";

export function useServicesList() {
  const { can } = useAuth();
  const canView = can("read", "Service");

  // Store
  const filters = useStore(servicesStore, (state) => state.filters);

  // Fetch
  const { data, error } = useSuspenseQuery(serviceQueries.list(canView));
  const services = data?.services ?? [];

  // Filter Logic
  const filteredServices = (() => {
    const searchTerm = filters.search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesStatus = filters.statuses.size === 0 || filters.statuses.has(service.status);
      const matchesType = filters.types.size === 0 || filters.types.has(service.service_type);
      const matchesSearch =
        !searchTerm ||
        `${service.name ?? ""} ${service.detail ?? ""} ${service.counterpart_name ?? ""}`
          .toLowerCase()
          .includes(searchTerm);
      return matchesStatus && matchesType && matchesSearch;
    });
  })();

  // Summaries
  const summaryTotals: SummaryTotals = (() => {
    if (filteredServices.length === 0) {
      return { activeCount: 0, overdueCount: 0, pendingCount: 0, totalExpected: 0, totalPaid: 0 };
    }
    return filteredServices.reduce(
      (acc, service) => {
        acc.totalExpected += service.total_expected;
        acc.totalPaid += service.total_paid;
        acc.pendingCount += service.pending_count;
        acc.overdueCount += service.overdue_count;
        if (service.status === "ACTIVE") acc.activeCount += 1;
        return acc;
      },
      { activeCount: 0, overdueCount: 0, pendingCount: 0, totalExpected: 0, totalPaid: 0 }
    );
  })();

  const collectionRate = summaryTotals.totalExpected > 0 ? summaryTotals.totalPaid / summaryTotals.totalExpected : 0;

  return {
    canView,
    collectionRate,
    filteredServices,
    filters,
    handleFilterChange: servicesActions.setFilters,
    listError: extractErrorMessage(error),
    services,
    setFilters: servicesActions.setFilters,
    summaryTotals,
  };
}
