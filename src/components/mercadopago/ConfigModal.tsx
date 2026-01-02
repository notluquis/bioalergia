import { useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { MPService } from "@/services/mercadopago";
import { useToast } from "@/context/ToastContext";

// Zod Schema mirroring backend
const ConfigSchema = z.object({
  file_name_prefix: z.string().min(1, "Prefijo requerido"),
  columns: z.array(z.object({ key: z.string().min(1) })).min(1, "Al menos una columna requerida"),
  frequency: z.object({
    type: z.enum(["daily", "weekly", "monthly"]),
    value: z.number().int().min(1),
    hour: z.number().int().min(0).max(23),
  }),
  sftp_info: z
    .object({
      server: z.string().optional(),
      username: z.string().optional(),
      remote_dir: z.string().optional(),
    })
    .optional(),
  separator: z.string().optional(),
  display_timezone: z.string().optional(),
});

type FormData = z.infer<typeof ConfigSchema>;

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

  const { register, control, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(ConfigSchema),
    defaultValues: {
      file_name_prefix: "mp-release-report",
      frequency: { type: "daily", value: 1, hour: 0 },
      columns: [
        { key: "DATE" },
        { key: "SOURCE_ID" },
        { key: "EXTERNAL_REFERENCE" },
        { key: "DESCRIPTION" },
        { key: "NET_CREDIT" },
        { key: "NET_DEBIT" },
        { key: "GROSS_AMOUNT" },
        { key: "MP_FEE_AMOUNT" },
        { key: "FINANCING_FEE_AMOUNT" },
        { key: "SHIPPING_FEE_AMOUNT" },
        { key: "TAXES_AMOUNT" },
        { key: "COUPON_AMOUNT" },
        { key: "INSTALLMENTS" },
        { key: "PAYMENT_METHOD" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "columns",
  });

  // Load existing config into form
  useEffect(() => {
    if (currentConfig) {
      reset({
        file_name_prefix: currentConfig.file_name_prefix,
        // @ts-ignore - enum mapping might be strict
        frequency: currentConfig.frequency,
        columns: currentConfig.columns,
        sftp_info: currentConfig.sftp_info,
        separator: currentConfig.separator,
        display_timezone: currentConfig.display_timezone,
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
    <Modal title="Configuración de Reportes" isOpen={open} onClose={onClose}>
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Prefijo Archivo" {...register("file_name_prefix")} />
            <Input label="Zona Horaria" {...register("display_timezone")} placeholder="GMT-04" />
          </div>

          <div className="bg-base-200/50 rounded-lg border p-4">
            <h4 className="mb-2 text-sm font-medium">Frecuencia</h4>
            <div className="grid grid-cols-3 gap-2">
              <select {...register("frequency.type")} className="select select-bordered select-sm w-full">
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
              <Input
                label="Valor"
                type="number"
                containerClassName="mt-0"
                {...register("frequency.value", { valueAsNumber: true })}
              />
              <Input
                label="Hora (0-23)"
                type="number"
                containerClassName="mt-0"
                {...register("frequency.hour", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="bg-base-200/50 rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-medium">Columnas</h4>
              <Button type="button" size="sm" variant="ghost" onClick={() => append({ key: "" })}>
                <Plus className="mr-1 h-3 w-3" /> Agregar
              </Button>
            </div>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <Input {...register(`columns.${index}.key`)} placeholder="Columna Key" containerClassName="flex-1" />
                  <Button type="button" size="sm" variant="ghost" className="text-error" onClick={() => remove(index)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">SFTP (Opcional)</h4>
            <Input label="Servidor" {...register("sftp_info.server")} />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Usuario" {...register("sftp_info.username")} />
              <Input label="Directorio Remoto" {...register("sftp_info.remote_dir")} />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Configuración
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
