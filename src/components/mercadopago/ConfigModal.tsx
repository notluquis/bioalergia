import { useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash, Info, CheckSquare, Square, RotateCcw } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { MPService } from "@/services/mercadopago";
import { useToast } from "@/context/ToastContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";

import { MP_REPORT_COLUMNS, MP_WEEKDAYS, MP_REPORT_LANGUAGES, MP_DEFAULT_COLUMNS } from "../../../shared/mercadopago";

// Zod Schema mirroring backend
const ConfigSchema = z.object({
  file_name_prefix: z.string().min(1, "Prefijo requerido"),
  columns: z
    .array(z.object({ key: z.string().min(1) }))
    .min(1, "Al menos una columna requerida")
    .max(MP_REPORT_COLUMNS.length, `Máximo ${MP_REPORT_COLUMNS.length} columnas permitidas`)
    .refine((cols) => new Set(cols.map((c) => c.key)).size === cols.length, "No se permiten columnas duplicadas"),
  frequency: z.object({
    type: z.enum(["daily", "weekly", "monthly"]),
    value: z.union([z.number().int().min(0).max(31), z.enum(MP_WEEKDAYS)]),
    hour: z.number().int().min(0).max(23),
  }),
  sftp_info: z
    .object({
      server: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      remote_dir: z.string().optional(),
      port: z.number().int().optional(),
    })
    .optional(),
  separator: z.string().optional(),
  display_timezone: z.string().optional(),
  report_translation: z.enum(MP_REPORT_LANGUAGES).optional(),
  notification_email_list: z.array(z.string().email()).optional(),
  include_withdrawal_at_end: z.boolean().optional(),
  check_available_balance: z.boolean().optional(),
  compensate_detail: z.boolean().optional(),
  execute_after_withdrawal: z.boolean().optional(),
});

type FormData = z.infer<typeof ConfigSchema>;

// Timezone groupings
const TIMEZONES = {
  "América Latina": [
    { value: "America/Santiago", label: "Santiago (GMT-04/-03)" },
    { value: "America/Buenos_Aires", label: "Buenos Aires (GMT-03)" },
    { value: "America/Sao_Paulo", label: "São Paulo (GMT-03)" },
    { value: "America/Mexico_City", label: "Ciudad de México (GMT-06)" },
    { value: "America/Bogota", label: "Bogotá (GMT-05)" },
    { value: "America/Lima", label: "Lima (GMT-05)" },
  ],
  Norteamérica: [
    { value: "America/New_York", label: "New York (EST/EDT)" },
    { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  ],
  Europa: [
    { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
    { value: "Europe/London", label: "Londres (GMT/BST)" },
  ],
  UTC: [{ value: "UTC", label: "UTC (Coordinated Universal Time)" }],
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConfigModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useToast();

  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["mp-config"],
    queryFn: MPService.getConfig,
    enabled: open,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(ConfigSchema),
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

  const frequencyType = watch("frequency.type");
  const currentColumns = watch("columns");

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "columns",
  });

  // Get available columns (not already selected)
  const selectedColumnKeys = new Set(currentColumns?.map((c) => c.key) || []);
  const availableColumns = MP_REPORT_COLUMNS.filter((col) => !selectedColumnKeys.has(col));
  const maxColumns = MP_REPORT_COLUMNS.length;
  const canAddColumn = fields.length < maxColumns && availableColumns.length > 0;

  // Load existing config into form (deduplicating columns if needed)
  useEffect(() => {
    if (currentConfig) {
      // Remove duplicate columns from existing config
      const seen = new Set<string>();
      const uniqueColumns = currentConfig.columns
        .filter((col) => {
          if (seen.has(col.key)) return false;
          seen.add(col.key);
          return true;
        })
        .slice(0, maxColumns); // Limit to maxColumns

      reset({
        file_name_prefix: currentConfig.file_name_prefix,
        frequency: currentConfig.frequency as FormData["frequency"],
        columns: uniqueColumns,
        sftp_info: currentConfig.sftp_info,
        separator: currentConfig.separator,
        display_timezone: currentConfig.display_timezone || "America/Santiago",
        report_translation: currentConfig.report_translation as "en" | "es" | "pt",
        include_withdrawal_at_end: currentConfig.include_withdrawal_at_end,
        check_available_balance: currentConfig.check_available_balance,
        compensate_detail: currentConfig.compensate_detail,
        execute_after_withdrawal: currentConfig.execute_after_withdrawal,
      });
    }
  }, [currentConfig, reset, maxColumns]);

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

  const onSubmit = (data: FormData) => {
    if (currentConfig) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSelectAllColumns = () => {
    replace(MP_REPORT_COLUMNS.map((key) => ({ key })));
  };

  const handleClearAllColumns = () => {
    replace([]);
  };

  const handleDefaultColumns = () => {
    replace(MP_DEFAULT_COLUMNS.map((key) => ({ key })));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal title="Configuración de Reportes MercadoPago" isOpen={open} onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {/* Prefix & Timezone */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Input label="Prefijo Archivo" {...register("file_name_prefix")} placeholder="release-report" />
              <p className="text-base-content/60 mt-1 text-xs">Nombre base para los archivos generados</p>
            </div>
            <div>
              <label className="label">
                <span className="label-text">Zona Horaria</span>
              </label>
              <select {...register("display_timezone")} className="select select-bordered w-full">
                {Object.entries(TIMEZONES).map(([region, zones]) => (
                  <optgroup key={region} label={region}>
                    {zones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-base-content/60 mt-1 text-xs">Zona horaria para las fechas del reporte</p>
            </div>
          </div>

          {/* Report Language - Selector */}
          <div>
            <label className="label">
              <span className="label-text">Idioma del Reporte</span>
            </label>
            <select {...register("report_translation")} className="select select-bordered w-full">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
            <p className="text-base-content/60 mt-1 text-xs">Idioma de los encabezados de columnas</p>
          </div>

          {/* Frequency Section */}
          <div className="bg-base-200/50 rounded-lg border p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
              Frecuencia de Generación
              <span className="badge badge-info badge-xs">Requerido</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {/* Type - Selector */}
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs">Tipo</span>
                </label>
                <select
                  {...register("frequency.type")}
                  className="select select-bordered select-sm w-full"
                  onChange={(e) => {
                    register("frequency.type").onChange(e);
                    // Reset value when type changes
                    if (e.target.value === "daily") {
                      reset({ ...watch(), frequency: { ...watch("frequency"), type: "daily", value: 0 } });
                    } else if (e.target.value === "weekly") {
                      reset({ ...watch(), frequency: { ...watch("frequency"), type: "weekly", value: "monday" } });
                    } else if (e.target.value === "monthly") {
                      reset({ ...watch(), frequency: { ...watch("frequency"), type: "monthly", value: 1 } });
                    }
                  }}
                >
                  <option value="daily">Diaria</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {/* Value - Dynamic based on type */}
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs">Valor</span>
                </label>
                {frequencyType === "weekly" ? (
                  <select className="select select-bordered select-sm w-full" {...register("frequency.value")}>
                    {MP_WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : frequencyType === "monthly" ? (
                  <Input
                    type="number"
                    containerClassName="mt-0"
                    {...register("frequency.value", { valueAsNumber: true })}
                    min={1}
                    max={31}
                    placeholder="1-31"
                  />
                ) : (
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full"
                    value={0}
                    disabled
                    title="Para diario, el valor es siempre 0"
                  />
                )}
              </div>

              {/* Hour - Selector */}
              <div>
                <label className="label py-1">
                  <span className="label-text text-xs">Hora (UTC)</span>
                </label>
                <select
                  {...register("frequency.hour", { valueAsNumber: true })}
                  className="select select-bordered select-sm w-full"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-base-content/60 mt-2 flex items-center gap-1 text-xs">
              <Info className="h-3 w-3" />
              {frequencyType === "daily" && "Se generará todos los días a la hora indicada"}
              {frequencyType === "weekly" && "Se generará el día de la semana seleccionado"}
              {frequencyType === "monthly" && "Se generará el día del mes indicado (1-31)"}
            </p>
          </div>

          {/* Columns Section - Selector */}
          <div className="bg-base-200/50 rounded-lg border p-4">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                Columnas
                <span className="badge badge-info badge-xs">Requerido</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleSelectAllColumns}
                  title="Seleccionar todas las columnas disponibles"
                >
                  <CheckSquare className="mr-1 h-3 w-3" /> Todas
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleClearAllColumns}
                  title="Limpiar selección"
                >
                  <Square className="mr-1 h-3 w-3" /> Ninguna
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleDefaultColumns}
                  title="Restaurar columnas por defecto"
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Por defecto
                </Button>
              </div>
            </div>

            {errors.columns && (
              <p className="text-error mb-2 text-xs">{errors.columns.message || errors.columns.root?.message}</p>
            )}

            <div className="mb-3 flex items-center justify-between text-xs">
              <p className="text-base-content/60">
                Seleccionadas: <span className="text-base-content font-medium">{fields.length}</span> / {maxColumns}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const firstAvailable = availableColumns[0];
                  if (firstAvailable) {
                    append({ key: firstAvailable });
                  }
                }}
                disabled={!canAddColumn}
                title={!canAddColumn ? `Máximo ${maxColumns} columnas o todas ya seleccionadas` : ""}
              >
                <Plus className="mr-1 h-3 w-3" /> Agregar Columna
              </Button>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {fields.map((field, index) => {
                // Get columns available for this specific row (current value + unselected)
                const currentValue = currentColumns?.[index]?.key;
                const rowAvailableColumns = MP_REPORT_COLUMNS.filter(
                  (col) => col === currentValue || !selectedColumnKeys.has(col)
                );
                return (
                  <div key={field.id} className="flex gap-2">
                    <span className="bg-base-300 text-base-content/50 flex h-8 w-8 items-center justify-center rounded font-mono text-xs">
                      {index + 1}
                    </span>
                    <Controller
                      name={`columns.${index}.key`}
                      control={control}
                      render={({ field: selectField }) => (
                        <select {...selectField} className="select select-bordered select-sm flex-1">
                          {rowAvailableColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-error hover:bg-error/10 hover:text-error"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            {fields.length >= maxColumns && (
              <p className="text-warning mt-2 text-center text-xs font-medium">
                Has seleccionado el máximo de columnas disponibles.
              </p>
            )}
          </div>

          {/* Boolean Options */}
          <div className="bg-base-200/50 rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-medium">Opciones Adicionales</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TooltipProvider>
                <div className="flex items-center justify-between gap-2">
                  <label className="label cursor-pointer justify-start gap-2 p-0">
                    <input
                      type="checkbox"
                      {...register("include_withdrawal_at_end")}
                      className="checkbox checkbox-sm"
                    />
                    <span className="label-text text-sm">Incluir retiros al final</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="text-base-content/40 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Agrega un resumen de los retiros de dinero al final del reporte.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="label cursor-pointer justify-start gap-2 p-0">
                    <input type="checkbox" {...register("check_available_balance")} className="checkbox checkbox-sm" />
                    <span className="label-text text-sm">Mostrar balance disponible</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="text-base-content/40 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Incluye una columna con el saldo acumulado después de cada movimiento.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="label cursor-pointer justify-start gap-2 p-0">
                    <input type="checkbox" {...register("compensate_detail")} className="checkbox checkbox-sm" />
                    <span className="label-text text-sm">Detalle compensaciones</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="text-base-content/40 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Muestra el detalle de disputas y contracargos asociados.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="label cursor-pointer justify-start gap-2 p-0">
                    <input type="checkbox" {...register("execute_after_withdrawal")} className="checkbox checkbox-sm" />
                    <span className="label-text text-sm">Ejecutar post-retiro</span>
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="text-base-content/40 h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Genera automáticamente un reporte cada vez que realizas un retiro de dinero.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {/* SFTP (Optional) */}
          <details className="bg-base-200/50 rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              Configuración SFTP <span className="text-base-content/60">(Opcional)</span>
            </summary>
            <div className="space-y-3 border-t p-4">
              <Input label="Servidor" {...register("sftp_info.server")} placeholder="sftp.ejemplo.com" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Usuario" {...register("sftp_info.username")} />
                <Input label="Contraseña" {...register("sftp_info.password")} type="password" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Puerto"
                  {...register("sftp_info.port", { valueAsNumber: true })}
                  type="number"
                  placeholder="22"
                />
                <Input label="Directorio Remoto" {...register("sftp_info.remote_dir")} placeholder="/reports" />
              </div>
            </div>
          </details>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentConfig ? "Actualizar" : "Crear"} Configuración
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
