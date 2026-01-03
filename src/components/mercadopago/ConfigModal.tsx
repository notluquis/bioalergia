import { CheckSquare, Info, Loader2, Plus, RotateCcw, Square, Trash } from "lucide-react";
import { Controller, useFieldArray } from "react-hook-form";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { useMercadoPagoConfig } from "@/hooks/useMercadoPago";
import { cn } from "@/lib/utils";

import { MP_DEFAULT_COLUMNS, MP_REPORT_COLUMNS, MP_REPORT_LANGUAGES, MP_WEEKDAYS } from "../../../shared/mercadopago";

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
  const { form, isLoading, isPending, currentConfig, onSubmit } = useMercadoPagoConfig(open, onClose);

  const {
    register,
    control,
    reset,
    watch,
    formState: { errors },
  } = form;

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

  return (
    <Modal title="Configuración de Reportes MercadoPago" isOpen={open} onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {/* Prefix & Timezone */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Input
                label="Prefijo Archivo"
                {...register("file_name_prefix")}
                placeholder="release-report"
                error={errors.file_name_prefix?.message}
              />
              <p className="text-base-content/60 mt-1 text-xs">Nombre base para los archivos generados</p>
            </div>
            <div>
              <label className="label" htmlFor="display_timezone">
                <span className="label-text">Zona Horaria</span>
              </label>
              <select
                id="display_timezone"
                {...register("display_timezone")}
                className={cn(
                  "select select-bordered focus:ring-primary/20 focus:border-primary w-full focus:ring-2 focus:outline-none",
                  errors.display_timezone && "select-error focus:ring-error/20 focus:border-error"
                )}
              >
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
              {errors.display_timezone && (
                <label className="label">
                  <span className="label-text-alt text-error">{errors.display_timezone.message}</span>
                </label>
              )}
              <p className="text-base-content/60 mt-1 text-xs">Zona horaria para las fechas del reporte</p>
            </div>
          </div>

          {/* Report Language - Selector */}
          <div>
            <label className="label" htmlFor="report_translation">
              <span className="label-text">Idioma del Reporte</span>
            </label>
            <select
              id="report_translation"
              {...register("report_translation")}
              className={cn(
                "select select-bordered focus:ring-primary/20 focus:border-primary w-full focus:ring-2 focus:outline-none",
                errors.report_translation && "select-error focus:ring-error/20 focus:border-error"
              )}
            >
              {MP_REPORT_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang === "es" ? "Español" : lang === "en" ? "English" : "Português"}
                </option>
              ))}
            </select>
            <p className="text-base-content/60 mt-1 text-xs">Idioma de los encabezados de columnas</p>
          </div>

          {/* Frequency Section */}
          <div className="bg-base-200/50 rounded-lg p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
              Frecuencia de Generación
              <span className="badge badge-info badge-xs">Requerido</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {/* Type - Selector */}
              <div>
                <label className="label py-1" htmlFor="frequency_type">
                  <span className="label-text text-xs">Tipo</span>
                </label>
                <select
                  id="frequency_type"
                  {...register("frequency.type")}
                  className={cn(
                    "select select-bordered select-sm focus:ring-primary/20 focus:border-primary w-full focus:ring-2 focus:outline-none",
                    errors.frequency?.type && "select-error focus:ring-error/20 focus:border-error"
                  )}
                  onChange={(e) => {
                    register("frequency.type").onChange(e);
                    // Reset value when type changes
                    if (e.target.value === "daily") {
                      reset({ ...watch(), frequency: { ...watch("frequency"), type: "daily", value: 0 } });
                    } else if (e.target.value === "weekly") {
                      reset({
                        ...watch(),
                        frequency: { ...watch("frequency"), type: "weekly", value: "monday" },
                      });
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
                <label className="label py-1" htmlFor="frequency_value">
                  <span className="label-text text-xs">Valor</span>
                </label>
                {frequencyType === "weekly" ? (
                  <select
                    id="frequency_value"
                    className={cn(
                      "select select-bordered select-sm focus:ring-primary/20 focus:border-primary w-full focus:ring-2 focus:outline-none",
                      errors.frequency?.value && "select-error focus:ring-error/20 focus:border-error"
                    )}
                    {...register("frequency.value")}
                  >
                    {MP_WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : frequencyType === "monthly" ? (
                  <Input
                    id="frequency_value"
                    type="number"
                    containerClassName="mt-0"
                    {...register("frequency.value", { valueAsNumber: true })}
                    min={1}
                    max={31}
                    placeholder="1-31"
                    error={errors.frequency?.value?.message}
                    size="sm"
                  />
                ) : (
                  <input
                    id="frequency_value"
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
                <label className="label py-1" htmlFor="frequency_hour">
                  <span className="label-text text-xs">Hora (UTC)</span>
                </label>
                <select
                  id="frequency_hour"
                  {...register("frequency.hour", { valueAsNumber: true })}
                  className={cn(
                    "select select-bordered select-sm focus:ring-primary/20 focus:border-primary w-full focus:ring-2 focus:outline-none",
                    errors.frequency?.hour && "select-error focus:ring-error/20 focus:border-error"
                  )}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {errors.frequency?.message && <p className="text-error mt-1 text-xs">{errors.frequency.message}</p>}
            <p className="text-base-content/60 mt-2 flex items-center gap-1 text-xs">
              <Info className="h-3 w-3" />
              {frequencyType === "daily" && "Se generará todos los días a la hora indicada"}
              {frequencyType === "weekly" && "Se generará el día de la semana seleccionado"}
              {frequencyType === "monthly" && "Se generará el día del mes indicado (1-31)"}
            </p>
          </div>

          {/* Columns Section - Selector */}
          <div className="bg-base-200/50 rounded-lg p-4">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h4 className="flex items-center gap-2 text-sm font-medium">
                  Columnas
                  <span className="badge badge-info badge-xs">Requerido</span>
                </h4>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help transition-opacity hover:opacity-80">
                        <Info className="text-base-content/40 h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      <p>
                        Selecciona y ordena las columnas que deseas incluir en el reporte.
                        <br />
                        Algunas columnas son obligatorias para el correcto funcionamiento del sistema.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const currentKeys = new Set(fields.map((f) => f.key));
                    const missing = MP_REPORT_COLUMNS.filter((k) => !currentKeys.has(k));
                    append(missing.map((key) => ({ key })));
                  }}
                  disabled={fields.length >= maxColumns}
                >
                  <CheckSquare className="mr-1 h-3 w-3" /> Todas
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => remove()}
                  disabled={fields.length === 0}
                >
                  <Square className="mr-1 h-3 w-3" /> Ninguna
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    replace(MP_DEFAULT_COLUMNS.map((key) => ({ key })));
                  }}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Por defecto
                </Button>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs">
              <p className="text-base-content/60">
                Seleccionadas: <span className="text-base-content font-medium">{fields.length}</span> / {maxColumns}
                {fields.length >= maxColumns && <span className="text-success ml-1">(Todas)</span>}
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

            {errors.columns && (
              <p className="text-error mb-2 text-xs">{errors.columns.message || errors.columns.root?.message}</p>
            )}

            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {fields.map((field, index) => {
                const currentValue = currentColumns?.[index]?.key;
                const rowAvailableColumns = MP_REPORT_COLUMNS.filter(
                  (col) => col === currentValue || !selectedColumnKeys.has(col)
                );
                return (
                  <div key={field.id} className="bg-base-200/30 flex items-center gap-2 rounded-md p-1">
                    <div className="bg-base-300 flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs opacity-50">
                      {index + 1}
                    </div>
                    <Controller
                      name={`columns.${index}.key`}
                      control={control}
                      render={({ field: selectField }) => (
                        <select
                          {...selectField}
                          className="select select-bordered select-sm focus:ring-primary/20 focus:border-primary flex-1 bg-transparent focus:ring-2 focus:outline-none"
                        >
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
                      className="text-error btn-square btn-sm hover:bg-error/10 h-8 w-8"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Boolean Options */}
          <div className="bg-base-200/50 rounded-lg p-4">
            <h4 className="mb-3 text-sm font-medium">Opciones Adicionales</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TooltipProvider delayDuration={0}>
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
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help transition-opacity hover:opacity-80">
                        <Info className="text-base-content/40 h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
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
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help transition-opacity hover:opacity-80">
                        <Info className="text-base-content/40 h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
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
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help transition-opacity hover:opacity-80">
                        <Info className="text-base-content/40 h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
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
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help transition-opacity hover:opacity-80">
                        <Info className="text-base-content/40 h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      <p>Genera automáticamente un reporte cada vez que realizas un retiro de dinero.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {/* SFTP (Optional) */}
          <details className="bg-base-200/50 rounded-lg">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              Configuración SFTP <span className="text-base-content/60">(Opcional)</span>
            </summary>
            <div className="space-y-3 border-t p-4">
              <Input
                label="Servidor"
                {...register("sftp_info.server")}
                placeholder="sftp.ejemplo.com"
                error={errors.sftp_info?.server?.message}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Usuario"
                  {...register("sftp_info.username")}
                  error={errors.sftp_info?.username?.message}
                />
                <Input
                  label="Contraseña"
                  {...register("sftp_info.password")}
                  type="password"
                  error={errors.sftp_info?.password?.message}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Puerto"
                  {...register("sftp_info.port", {
                    setValueAs: (v) => (v === "" ? undefined : Number(v)),
                  })}
                  type="number"
                  placeholder="22"
                  error={errors.sftp_info?.port?.message}
                />
                <Input
                  label="Directorio Remoto"
                  {...register("sftp_info.remote_dir")}
                  placeholder="/reports"
                  error={errors.sftp_info?.remote_dir?.message}
                />
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
