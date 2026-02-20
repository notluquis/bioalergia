import { servicesActions } from "../store";
import type { CreateServicePayload, RegenerateServicePayload, ServiceSchedule } from "../types";

import { useServiceDetails } from "./use-service-details";
import { useServiceMutations } from "./use-service-mutations";
import { useServicePayment } from "./use-service-payment";
import { useServicesList } from "./use-services-list";

// Deprecated Provider - kept for compatibility but does nothing now
// Can be removed once all usages are confirmed gone (it's not used in OverviewPage or Content)
export function ServicesProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useServicesOverview() {
  const list = useServicesList();
  const details = useServiceDetails(list.services);
  const mutations = useServiceMutations();
  const payment = useServicePayment();

  // Combine States
  const loadingDetail = details.aggregatedLoading || mutations.regeneratePending;

  // Composite Handlers
  const handleAgendaRegisterPayment = (id: string, s: ServiceSchedule) => {
    details.setSelectedId(id);
    payment.openPaymentModal(s);
  };

  const handleAgendaUnlinkPayment = async (id: string, s: ServiceSchedule) => {
    details.setSelectedId(id);
    await mutations.unlinkPayment(s.id);
  };

  const handleCreateService = async (payload: CreateServicePayload) => {
    await mutations.createService(payload);
  };

  const handleRegenerate = async (overrides: RegenerateServicePayload) => {
    if (!details.selectedService) {
      return;
    }
    await mutations.regenerateService(details.selectedService.publicId, overrides);
  };

  const handleUnlink = async (schedule: ServiceSchedule) => {
    await mutations.unlinkPayment(schedule.id);
  };

  const handleEditSchedule = (serviceId: string, schedule: ServiceSchedule) => {
    details.setSelectedId(serviceId);
    servicesActions.openEditScheduleModal(schedule);
  };

  const handleSkipSchedule = (serviceId: string, schedule: ServiceSchedule) => {
    details.setSelectedId(serviceId);
    servicesActions.openSkipScheduleModal(schedule);
  };

  const handleSyncAllTransactions = async () => {
    return await mutations.syncAllTransactions();
  };

  const handleSyncSelectedServiceTransactions = async () => {
    if (!details.selectedService) {
      return null;
    }
    return await mutations.syncServiceTransactions(details.selectedService.publicId);
  };

  return {
    ...list,
    ...details,
    ...mutations,
    ...payment,

    applyTemplate: details.openCreateModal,

    canManage: mutations.canManage, // derived in mutations
    closeCreateModal: details.closeCreateModal,
    globalError: list.listError,
    // Renamed or Composite Handlers for View Compatibility
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,

    handleCreateService,
    handleEditSchedule,
    handleRegenerate,
    handleSyncAllTransactions,
    handleSyncSelectedServiceTransactions,
    handleSkipSchedule,
    handleUnlink,
    // Computed / Combined
    loadingDetail,

    loadingList: false, // Suspense handles this now, so basic loading is false after boundary
    // Modal & Action props that might expect specific signatures
    openCreateModal: details.openCreateModal,
    // Explicit mappings if names mismatched (checked and they align mostly)
    processingPayment: payment.paymentPending,
  };
}
