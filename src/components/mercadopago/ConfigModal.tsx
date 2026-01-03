import { useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash, Info } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { MPService } from "@/services/mercadopago";
import { useToast } from "@/context/ToastContext";

// Valid column keys from MercadoPago API
const VALID_COLUMNS = [
  "DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "RECORD_TYPE",
  "DESCRIPTION",
  "NET_CREDIT_AMOUNT",
  "NET_DEBIT_AMOUNT",
  "SELLER_AMOUNT",
  "GROSS_AMOUNT",
  "METADATA",
  "MP_FEE_AMOUNT",
  "FINANCING_FEE_AMOUNT",
  "SHIPPING_FEE_AMOUNT",
  "TAXES_AMOUNT",
  "COUPON_AMOUNT",
  "INSTALLMENTS",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
  "TAX_DETAIL",
  "TAX_AMOUNT_TELCO",
  "TRANSACTION_APPROVAL_DATE",
  "POS_ID",
  "POS_NAME",
  "EXTERNAL_POS_ID",
  "STORE_ID",
  "STORE_NAME",
  "EXTERNAL_STORE_ID",
  "ORDER_ID",
  "SHIPPING_ID",
  "SHIPMENT_MODE",
  "PACK_ID",
  "TAXES_DISAGGREGATED",
  "EFFECTIVE_COUPON_AMOUNT",
  "POI_ID",
  "CARD_INITIAL_NUMBER",
  "OPERATION_TAGS",
  "ITEM_ID",
  "BALANCE_AMOUNT",
  "PAYOUT_BANK_ACCOUNT_NUMBER",
  "PRODUCT_SKU",
  "SALE_DETAIL",
  "CURRENCY",
  "FRANCHISE",
  "LAST_FOUR_DIGITS",
  "ORDER_MP",
  "TRANSACTION_INTENT_ID",
  "PURCHASE_ID",
  "IS_RELEASED",
  "SHIPPING_ORDER_ID",
  "ISSUER_NAME",
] as const;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const REPORT_LANGUAGES = ["en", "es", "pt"] as const;

// Zod Schema mirroring backend
const ConfigSchema = z.object({
  file_name_prefix: z.string().min(1, "Prefijo requerido"),
  columns: z.array(z.object({ key: z.string().min(1) })).min(1, "Al menos una columna requerida"),
  frequency: z.object({
    type: z.enum(["daily", "weekly", "monthly"]),
    value: z.union([z.number().int().min(0).max(31), z.enum(WEEKDAYS)]),
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
  report_translation: z.enum(REPORT_LANGUAGES).optional(),
  notification_email_list: z.array(z.string().email()).optional(),
  include_withdrawal_at_end: z.boolean().optional(),
  check_available_balance: z.boolean().optional(),
  compensate_detail: z.boolean().optional(),
  execute_after_withdrawal: z.boolean().optional(),
});

type FormData = z.infer<typeof ConfigSchema>;

// Default columns for a typical release report
const DEFAULT_COLUMNS = [
  "DATE",
  "SOURCE_ID",
  "EXTERNAL_REFERENCE",
  "DESCRIPTION",
  "NET_CREDIT_AMOUNT",
  "NET_DEBIT_AMOUNT",
  "GROSS_AMOUNT",
  "MP_FEE_AMOUNT",
  "PAYMENT_METHOD",
  "PAYMENT_METHOD_TYPE",
];

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

  const { register, control, handleSubmit, reset, watch } = useForm<FormData>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      file_name_prefix: "release-report",
      frequency: { type: "daily", value: 0, hour: 8 },
      columns: DEFAULT_COLUMNS.map((key) => ({ key })),
      display_timezone: "GMT-04",
      report_translation: "es",
      include_withdrawal_at_end: true,
      check_available_balance: true,
      compensate_detail: true,
      execute_after_withdrawal: false,
    },
  });

  const frequencyType = watch("frequency.type");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "columns",
  });

  // Load existing config into form
  useEffect(() => {
    if (currentConfig) {
      reset({
        file_name_prefix: currentConfig.file_name_prefix,
        frequency: currentConfig.frequency as FormData["frequency"],
        columns: currentConfig.columns,
        sftp_info: currentConfig.sftp_info,
        separator: currentConfig.separator,
        display_timezone: currentConfig.display_timezone || "GMT-04",
        report_translation: currentConfig.report_translation as "en" | "es" | "pt",
        include_withdrawal_at_end: currentConfig.include_withdrawal_at_end,
        check_available_balance: currentConfig.check_available_balance,
        compensate_detail: currentConfig.compensate_detail,
        execute_after_withdrawal: currentConfig.execute_after_withdrawal,
      });
    }
  }, [currentConfig, reset]);

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
              <Input label="Zona Horaria" {...register("display_timezone")} placeholder="GMT-04" />
              <p className="text-base-content/60 mt-1 text-xs">Por defecto: GMT-04</p>
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
                <select {...register("frequency.type")} className="select select-bordered select-sm w-full">
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
                  <Controller
                    name="frequency.value"
                    control={control}
                    render={({ field }) => (
                      <select
                        {...field}
                        className="select select-bordered select-sm w-full"
                        onChange={(e) => field.onChange(e.target.value)}
                      >
                        <option value="monday">Lunes</option>
                        <option value="tuesday">Martes</option>
                        <option value="wednesday">Miércoles</option>
                        <option value="thursday">Jueves</option>
                        <option value="friday">Viernes</option>
                        <option value="saturday">Sábado</option>
                        <option value="sunday">Domingo</option>
                      </select>
                    )}
                  />
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
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                Columnas del Reporte
                <span className="badge badge-info badge-xs">Requerido</span>
              </h4>
              <Button type="button" size="sm" variant="ghost" onClick={() => append({ key: "DATE" })}>
                <Plus className="mr-1 h-3 w-3" /> Agregar
              </Button>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Controller
                    name={`columns.${index}.key`}
                    control={control}
                    render={({ field: selectField }) => (
                      <select {...selectField} className="select select-bordered select-sm flex-1">
                        {VALID_COLUMNS.map((col) => (
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
                    className="text-error"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-base-content/60 mt-2 text-xs">
              {fields.length} columna{fields.length !== 1 ? "s" : ""} seleccionada{fields.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Boolean Options */}
          <div className="bg-base-200/50 rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-medium">Opciones Adicionales</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" {...register("include_withdrawal_at_end")} className="checkbox checkbox-sm" />
                <span className="label-text text-xs">Incluir retiros al final</span>
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" {...register("check_available_balance")} className="checkbox checkbox-sm" />
                <span className="label-text text-xs">Mostrar balance disponible</span>
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" {...register("compensate_detail")} className="checkbox checkbox-sm" />
                <span className="label-text text-xs">Detalle compensaciones</span>
              </label>
              <label className="label cursor-pointer justify-start gap-2">
                <input type="checkbox" {...register("execute_after_withdrawal")} className="checkbox checkbox-sm" />
                <span className="label-text text-xs">Ejecutar post-retiro</span>
              </label>
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
