import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MpConfigSchema, MpConfigFormData, MP_DEFAULT_COLUMNS, MP_REPORT_COLUMNS } from "../../shared/mercadopago";
import { MPService } from "@/services/mercadopago";
import { useToast } from "@/context/ToastContext";
import { useEffect } from "react";

export function useMercadoPagoConfig(isOpen: boolean, onClose: () => void) {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  // Query existing config
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["mp-config"],
    queryFn: MPService.getConfig,
    enabled: isOpen,
  });

  // Form Setup
  const form = useForm<MpConfigFormData>({
    resolver: zodResolver(MpConfigSchema),
    defaultValues: {
      file_name_prefix: "release-report",
      frequency: { type: "daily", value: 0, hour: 8 },
      columns: MP_DEFAULT_COLUMNS.map((key) => ({ key })),
      display_timezone: "America/Santiago",
      report_translation: "es",
      include_withdrawal_at_end: true,
      check_available_balance: true,
      compensate_detail: true,
      execute_after_withdrawal: false,
    },
  });

  // Sync form with data
  useEffect(() => {
    if (currentConfig) {
      // Deduplicate columns logic
      const seen = new Set<string>();
      const maxColumns = MP_REPORT_COLUMNS.length;
      const uniqueColumns = currentConfig.columns
        .filter((col) => {
          if (seen.has(col.key)) return false;
          seen.add(col.key);
          return true;
        })
        .slice(0, maxColumns);

      form.reset({
        ...currentConfig,
        columns: uniqueColumns,
        // Ensure enums match exact types
        frequency: currentConfig.frequency as MpConfigFormData["frequency"],
        report_translation: currentConfig.report_translation as MpConfigFormData["report_translation"],
        display_timezone: currentConfig.display_timezone || "America/Santiago",
      });
    }
  }, [currentConfig, form]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: MPService.createConfig,
    onSuccess: () => {
      showSuccess("Configuración creada");
      queryClient.invalidateQueries({ queryKey: ["mp-config"] });
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: MPService.updateConfig,
    onSuccess: () => {
      showSuccess("Configuración actualizada");
      queryClient.invalidateQueries({ queryKey: ["mp-config"] });
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  const onSubmit = (data: MpConfigFormData) => {
    if (currentConfig) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return {
    form,
    isLoading,
    isPending: createMutation.isPending || updateMutation.isPending,
    currentConfig,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
