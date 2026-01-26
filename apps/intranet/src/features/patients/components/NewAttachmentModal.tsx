import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Save, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";
import { apiClient } from "@/lib/api-client";

interface NewAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
}

export default function NewAttachmentModal({
  isOpen,
  onClose,
  patientId,
}: NewAttachmentModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("OTHER");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Debe seleccionar un archivo");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name);
      formData.append("type", type);

      return await apiClient.post(`/api/patients/${patientId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    },
    onSuccess: () => {
      toast.success("Documento subido exitosamente");
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      handleClose();
    },
    onError: (error) => {
      toast.error(
        `Error: ${error instanceof Error ? error.message : "No se pudo subir el archivo"}`,
      );
    },
  });

  const handleClose = () => {
    setFile(null);
    setName("");
    setType("OTHER");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cargar Documento">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-default-200 rounded-xl p-8 bg-default-50/50 hover:bg-default-50 transition-colors">
            {file ? (
              <div className="flex items-center gap-3 w-full">
                <div className="bg-primary/10 p-3 rounded-lg text-primary text-sm font-bold truncate flex-1">
                  {file.name}
                </div>
                <Button variant="ghost" size="sm" isIconOnly onClick={() => setFile(null)}>
                  <X size={18} />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <div className="bg-primary/10 p-4 rounded-full text-primary">
                  <FileUp size={32} />
                </div>
                <span className="text-sm font-medium">Haga clic para seleccionar un archivo</span>
                <span className="text-xs text-default-300">PDF, Imágenes, etc.</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      if (!name) setName(f.name);
                    }
                  }}
                />
              </label>
            )}
          </div>

          <Input
            label="Nombre del Documento"
            placeholder="Ej: Consentimiento informado"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Select
            label="Categoría"
            selectedKey={type}
            onSelectionChange={(key) => {
              if (key) setType(String(key));
            }}
          >
            <SelectItem key="CONSENT" textValue="Consentimiento">
              Consentimiento
            </SelectItem>
            <SelectItem key="EXAM" textValue="Examen / Resultado">
              Examen / Resultado
            </SelectItem>
            <SelectItem key="RECIPE" textValue="Receta / Indicación">
              Receta / Indicación
            </SelectItem>
            <SelectItem key="OTHER" textValue="Otro">
              Otro
            </SelectItem>
          </Select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-default-100">
          <Button variant="ghost" onClick={handleClose} isDisabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            isLoading={mutation.isPending}
            className="gap-2"
            isDisabled={!file}
            onClick={() => mutation.mutate()}
          >
            <Save size={18} />
            Subir Documento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
