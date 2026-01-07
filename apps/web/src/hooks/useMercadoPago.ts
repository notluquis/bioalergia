import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { useToast } from "@/context/ToastContext";
import { MpReportType, MPService } from "@/services/mercadopago";

import {
  MP_DEFAULT_COLUMNS,
  MP_SETTLEMENT_DEFAULTS,
  MpConfigFormData,
  MpReleaseConfigSchema,
  MpSettlementConfigSchema,
} from "../../shared/mercadopago";

export function useMercadoPagoConfig(isOpen: boolean, onClose: () => void, reportType: MpReportType = "release") {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  // Query existing config
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["mp-config", reportType], // include type in key
    queryFn: () => MPService.getConfig(reportType),
    enabled: isOpen,
  });

  // Determine Schema and Defaults based on Type
  const schema = reportType === "release" ? MpReleaseConfigSchema : MpSettlementConfigSchema;

  const defaultValues = useMemo(() => {
    const defaultCols =
      reportType === "release"
        ? MP_DEFAULT_COLUMNS.map((key) => ({ key }))
        : MP_SETTLEMENT_DEFAULTS.map((key) => ({ key }));

    const defaults: Partial<MpConfigFormData> = {
      file_name_prefix: reportType === "release" ? "release-report" : "settlement-report",
      frequency: { type: "daily", value: 0, hour: 8 },
      columns: defaultCols,
      display_timezone: "America/Santiago",
      report_translation: "es",
    };

    // Specific Defaults
    if (reportType === "release") {
      Object.assign(defaults, {
        include_withdrawal_at_end: true,
        check_available_balance: true,
        compensate_detail: true,
        execute_after_withdrawal: false,
      });
    } else {
      Object.assign(defaults, {
        show_fee_prevision: false,
        show_chargeback_cancel: true,
        coupon_detailed: true,
        include_withdraw: true,
        shipping_detail: true,
        refund_detailed: true,
      });
    }
    return defaults;
  }, [reportType]);

  // Form Setup
  const form = useForm<MpConfigFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Sync form with data
  useEffect(() => {
    if (currentConfig) {
      // Deduplicate columns logic can be refined, here we just pass what we got + limit if needed
      // Logic for deduplication from "release" might not be needed if backend handles it well,
      // but let's keep it safe.

      const uniqueColumns = currentConfig.columns; // Simplify for now

      form.reset({
        ...defaultValues, // keep defaults for missing fields
        ...currentConfig,
        columns: uniqueColumns,
        // Ensure enums match exact types
        frequency: currentConfig.frequency,
      });
    } else {
      // If config failed (404), reset to defaults?
      // form is already at defaults.
    }
  }, [currentConfig, form, reportType, defaultValues]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: MpConfigFormData) => MPService.createConfig(data, reportType),
    onSuccess: () => {
      showSuccess("Configuración creada");
      queryClient.invalidateQueries({ queryKey: ["mp-config", reportType] });
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: MpConfigFormData) => MPService.updateConfig(data, reportType),
    onSuccess: () => {
      showSuccess("Configuración actualizada");
      queryClient.invalidateQueries({ queryKey: ["mp-config", reportType] });
      onClose();
    },
    onError: (e: Error) => showError(e.message),
  });

  const onSubmit = (data: MpConfigFormData) => {
    // Sanitize and Validate SFTP info
    const sftp = data.sftp_info;
    let sanitizedData = { ...data };

    if (sftp) {
      // Check if any field has content
      const hasAnyContent =
        !!sftp.server ||
        !!sftp.username ||
        !!sftp.password ||
        !!sftp.remote_dir ||
        (sftp.port !== undefined && !isNaN(sftp.port));

      if (!hasAnyContent) {
        // Case 1: All empty -> Send undefined (disable SFTP)
        sanitizedData.sftp_info = undefined;
      } else {
        // Case 2: Partial content -> Validate required fields
        const missingFields = [];
        if (!sftp.server) missingFields.push("Servidor");
        if (!sftp.username) missingFields.push("Usuario");
        if (!sftp.password) missingFields.push("Contraseña");

        if (missingFields.length > 0) {
          showError(`Configuración SFTP incompleta. Faltan: ${missingFields.join(", ")}`);
          return; // Stop submission
        }

        // Case 3: Valid -> Clean and format
        sanitizedData.sftp_info = {
          ...sftp,
          server: sftp.server,
          username: sftp.username,
          password: sftp.password,
          remote_dir: sftp.remote_dir || "/", // Default to root if missing
          port: sftp.port || 22, // Default to 22 if missing
        };
      }
    }

    // Sanitize Frequency: Daily should not have a 'value'.
    const frequency = { ...data.frequency };
    if (frequency.type === "daily") {
      // Daily frequency has value 0 per schema
      frequency.value = 0;
    } else {
      // Ensure value is integer
      frequency.value = Number(frequency.value);
    }
    sanitizedData.frequency = frequency;

    if (currentConfig) {
      updateMutation.mutate(sanitizedData);
    } else {
      createMutation.mutate(sanitizedData);
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
