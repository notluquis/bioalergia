import { Button, Card } from "@heroui/react";
import { useState } from "react";
import { Field, TextInput } from "../components/FormField";
import { useImportMineduc } from "../hooks/useOutreach";

const DEFAULT_URL =
  "https://datosabiertos.mineduc.cl/wp-content/uploads/2024/08/20240201_Directorio_Establecimientos_Educacionales.csv";

export function OutreachImportPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const importM = useImportMineduc();

  const startUrlImport = () => importM.mutate({ source: "url", url });

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const b64 = result.split(",")[1] ?? "";
        importM.mutate({ source: "upload", csvBase64: b64 });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="font-bold text-2xl">Importar dataset MINEDUC</h1>
        <p className="text-default-500 text-sm">
          Filtra al Gran Concepción y preserva datos enriquecidos. Establecimientos que ya no
          aparezcan quedan marcados como inactivos.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Importar desde URL oficial</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          <Field label="URL CSV">
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Button variant="primary" isDisabled={importM.isPending} onPress={startUrlImport}>
            {importM.isPending ? "Procesando..." : "Importar desde URL"}
          </Button>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>O subir CSV manualmente</Card.Title>
        </Card.Header>
        <Card.Content className="p-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </Card.Content>
      </Card>

      {importM.isError && (
        <Card>
          <Card.Content className="p-4">
            <p className="text-danger text-sm">
              Error: {(importM.error as Error)?.message ?? "desconocido"}
            </p>
          </Card.Content>
        </Card>
      )}

      {importM.data && (
        <Card>
          <Card.Header>
            <Card.Title>Última importación</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-1 p-4 text-sm">
            <p>Filas leídas: {importM.data.log.totalRows}</p>
            <p className="text-success">Nuevos: {importM.data.log.nuevos}</p>
            <p>Actualizados: {importM.data.log.actualizados}</p>
            <p className="text-warning">Inactivos: {importM.data.log.inactivos}</p>
            {importM.data.log.errores > 0 && (
              <p className="text-danger">Errores: {importM.data.log.errores}</p>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
