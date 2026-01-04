import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { useToast } from "@/context/ToastContext";
import { MPService } from "@/services/mercadopago";

import { MP_DEFAULT_COLUMNS, MP_REPORT_COLUMNS, MpConfigFormData, MpConfigSchema } from "../../shared/mercadopago";

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
