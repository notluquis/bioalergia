import { Label, ListBox, Modal, Select } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, Save, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileInput } from "@/components/ui/FileInput";
import { Input } from "@/components/ui/Input";
import { AttachmentSchema } from "@/features/patients/schemas";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast-interceptor";

interface NewAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
}
export function NewAttachmentModal({ isOpen, onClose, patientId }: NewAttachmentModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("OTHER");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Debe seleccionar un archivo");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name || file.name);
      formData.append("type", type);

      return await apiClient.post(`/api/patients/${patientId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseSchema: AttachmentSchema,
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
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Cargar Documento</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-default-200 border-dashed bg-default-50/50 p-8 transition-colors hover:bg-default-50">
                    {file ? (
                      <div className="flex w-full items-center gap-3">
                        <div className="flex-1 truncate rounded-lg bg-primary/10 p-3 font-bold text-primary text-sm">
                          {file.name}
                        </div>
                        <Button variant="ghost" size="sm" isIconOnly onClick={() => setFile(null)}>
                          <X size={18} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex w-full flex-col items-center gap-2">
                        <div className="rounded-full bg-primary/10 p-4 text-primary">
                          <FileUp size={32} />
                        </div>
                        <span className="font-medium text-sm">
                          Haga clic para seleccionar un archivo
                        </span>
                        <span className="text-default-300 text-xs">PDF, Imágenes, etc.</span>
                        <FileInput
                          className="min-h-0 border-none bg-transparent p-0"
                          label=""
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setFile(f);
                              if (!name) {
                                setName(f.name);
                              }
                            }
                          }}
                          accept="application/pdf,image/*"
                        />
                      </div>
                    )}
                  </div>

                  <Input
                    label="Nombre del Documento"
                    placeholder="Ej: Consentimiento informado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <Select
                    value={type}
                    onChange={(key) => {
                      if (key) {
                        setType(String(key));
                      }
                    }}
                  >
                    <Label>Categoría</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="CONSENT" textValue="Consentimiento">
                          Consentimiento
                        </ListBox.Item>
                        <ListBox.Item id="EXAM" textValue="Examen / Resultado">
                          Examen / Resultado
                        </ListBox.Item>
                        <ListBox.Item id="RECIPE" textValue="Receta / Indicación">
                          Receta / Indicación
                        </ListBox.Item>
                        <ListBox.Item id="OTHER" textValue="Otro">
                          Otro
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="flex justify-end gap-3 border-default-100 border-t pt-4">
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
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
