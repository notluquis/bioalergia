import { Button, Chip, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import type {
  ProductDocumentDto,
  ProductDocumentType,
} from "@finanzas/orpc-contracts/product-documents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast-interceptor";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  presignUpload,
  productDocumentsKeys,
} from "../api";

const DOC_TYPES: { id: ProductDocumentType; label: string }[] = [
  { id: "IFU", label: "IFU (Instrucciones de uso)" },
  { id: "SDS", label: "SDS (Hoja de seguridad)" },
  { id: "COA", label: "CoA (Certificado de análisis)" },
  { id: "SPEC_SHEET", label: "Ficha técnica" },
  { id: "ISO_CERT", label: "Certificado ISO" },
  { id: "PACKAGE_INSERT", label: "Inserto de envase" },
];

const TYPE_LABEL: Record<ProductDocumentType, string> = {
  IFU: "IFU",
  SDS: "SDS",
  COA: "CoA",
  SPEC_SHEET: "Ficha técnica",
  ISO_CERT: "ISO",
  PACKAGE_INSERT: "Inserto",
};

const ACCEPTED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
type AcceptedContentType = (typeof ACCEPTED_CONTENT_TYPES)[number];

function isAcceptedContentType(value: string): value is AcceptedContentType {
  return (ACCEPTED_CONTENT_TYPES as readonly string[]).includes(value);
}

type ProductDocumentsManagerProps = {
  productId: number;
};

export function ProductDocumentsManager({ productId }: ProductDocumentsManagerProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ProductDocumentType>("IFU");
  const [title, setTitle] = useState("");

  const documentsQuery = useQuery({
    queryKey: productDocumentsKeys.byProduct(productId),
    queryFn: () => listDocuments(productId),
  });
  const documents = documentsQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: productDocumentsKeys.byProduct(productId) });

  const resetForm = () => {
    setFile(null);
    setTitle("");
    setType("IFU");
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecciona un archivo");
      if (!isAcceptedContentType(file.type)) {
        throw new Error(`Tipo no permitido: ${file.type || "desconocido"} (solo PDF, JPEG o PNG)`);
      }
      const presign = await presignUpload({ filename: file.name, contentType: file.type });
      const put = await fetch(presign.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error(`Subida a R2 falló: ${put.status}`);
      return createDocument({
        productId,
        type,
        title: title.trim() || file.name,
        fileR2Key: presign.r2Key,
        language: "es",
        sortOrder: documents.length,
      });
    },
    onSuccess: () => {
      toast.success("Ficha técnica subida");
      resetForm();
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo subir la ficha"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => {
      toast.success("Ficha eliminada");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const handleDelete = async (doc: ProductDocumentDto) => {
    const ok = await confirmAction({
      title: "Eliminar ficha técnica",
      description: `¿Eliminar "${doc.title}"?`,
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(doc.id);
  };

  const hasFile = file != null;

  return (
    <div className="space-y-4">
      {/* ── Documentos existentes ──────────────────────────────────── */}
      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-default-200 bg-default-50 px-3 py-2"
            >
              <FileText className="size-4 shrink-0 text-default-400" />
              <div className="min-w-0 flex-1">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-sm hover:underline"
                >
                  {doc.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Chip size="sm" variant="secondary">
                    {TYPE_LABEL[doc.type]}
                  </Chip>
                  <Chip size="sm" variant={doc.visibility === "PUBLIC" ? "primary" : "secondary"}>
                    {doc.visibility === "PUBLIC" ? "Público" : "Interno"}
                  </Chip>
                  {doc.version ? (
                    <Chip size="sm" variant="secondary">
                      v{doc.version}
                    </Chip>
                  ) : null}
                  {doc.lotNumber ? (
                    <Chip size="sm" variant="secondary">
                      Lote {doc.lotNumber}
                    </Chip>
                  ) : null}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                className="text-danger"
                aria-label={`Eliminar ${doc.title}`}
                isPending={deleteMutation.isPending}
                onPress={() => void handleDelete(doc)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-default-500 text-sm">
          {documentsQuery.isLoading ? "Cargando fichas…" : "Aún no hay fichas técnicas."}
        </p>
      )}

      {/* ── Formulario de subida ───────────────────────────────────── */}
      <div className="space-y-3 rounded-xl border border-default-200 border-dashed p-4">
        <div className="space-y-1">
          <Label>Archivo (PDF o imagen)</Label>
          <input
            ref={inputRef}
            type="file"
            aria-label="Seleccionar archivo de ficha técnica"
            accept=".pdf,image/jpeg,image/png"
            className="block w-full text-default-600 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-default-100 file:px-3 file:py-1.5 file:font-medium file:text-default-700 file:text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Select
          selectedKey={type}
          onSelectionChange={(key) => {
            if (key) setType(String(key) as ProductDocumentType);
          }}
        >
          <Label>Tipo de documento</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {DOC_TYPES.map((t) => (
                <ListBox.Item key={t.id} id={t.id} textValue={t.label}>
                  {t.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <TextField value={title} onChange={setTitle}>
          <Label>Título</Label>
          <Input placeholder="Ej: Instrucciones de uso — Phadia 250" />
        </TextField>

        <Button
          className="gap-2"
          isPending={uploadMutation.isPending}
          isDisabled={!hasFile}
          onPress={() => uploadMutation.mutate()}
        >
          <Upload size={16} /> Subir
        </Button>
      </div>
    </div>
  );
}
