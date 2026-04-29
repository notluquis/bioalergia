import { Button, Card, Chip } from "@heroui/react";
import { useState } from "react";
import { Field, TextInput } from "../components/FormField";
import { useImportMineduc } from "../hooks/useOutreach";

const DEFAULT_URL =
  "https://datosabiertos.mineduc.cl/wp-content/uploads/2024/08/20240201_Directorio_Establecimientos_Educacionales.csv";

const GRAN_CONCEPCION = [
  "CONCEPCION",
  "TALCAHUANO",
  "SAN PEDRO DE LA PAZ",
  "CHIGUAYANTE",
  "CORONEL",
  "LOTA",
  "HUALPEN",
  "PENCO",
  "TOME",
  "FLORIDA",
  "HUALQUI",
  "SANTA JUANA",
];

const PRESETS: Record<string, string[]> = {
  "Gran Concepción (12)": GRAN_CONCEPCION,
  "Concepción núcleo (4)": ["CONCEPCION", "TALCAHUANO", "SAN PEDRO DE LA PAZ", "CHIGUAYANTE"],
};

export function OutreachImportPage() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [comunas, setComunas] = useState<string[]>(GRAN_CONCEPCION);
  const [extraComuna, setExtraComuna] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const importM = useImportMineduc();

  const toggle = (c: string) => {
    setComunas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const addExtra = () => {
    const v = extraComuna.trim().toUpperCase();
    if (!v) return;
    if (!comunas.includes(v)) setComunas((p) => [...p, v]);
    setExtraComuna("");
  };

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (p) setComunas([...p]);
  };

  const startUrlImport = () => importM.mutate({ source: "url", url, comunas, dryRun });

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const b64 = result.split(",")[1] ?? "";
        importM.mutate({ source: "upload", csvBase64: b64, comunas, dryRun });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="font-bold text-2xl">Importar dataset MINEDUC</h1>
        <p className="text-default-500 text-sm">
          Selecciona qué comunas filtrar. Establecimientos existentes en esas comunas que ya no
          aparezcan quedan marcados como inactivos. Datos enriquecidos (notas, etiquetas, contactos,
          interacciones) se preservan.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Comunas a importar</Card.Title>
          <Card.Description>{comunas.length} seleccionadas · click para alternar</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((k) => (
              <Button key={k} size="sm" variant="secondary" onPress={() => applyPreset(k)}>
                {k}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onPress={() => setComunas([])}>
              Limpiar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from(new Set([...GRAN_CONCEPCION, ...comunas]))
              .sort()
              .map((c) => {
                const active = comunas.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    className="cursor-pointer"
                  >
                    <Chip color={active ? "success" : "default"} variant="soft" size="sm">
                      {active ? "✓ " : ""}
                      {c}
                    </Chip>
                  </button>
                );
              })}
          </div>

          <div className="flex gap-2">
            <TextInput
              placeholder="Agregar comuna manualmente (ej: ARAUCO)"
              value={extraComuna}
              onChange={(e) => setExtraComuna(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExtra();
                }
              }}
            />
            <Button size="sm" variant="secondary" onPress={addExtra}>
              Añadir
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Modo simulación (no escribe en DB, solo cuenta filas)
          </label>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Importar desde URL oficial</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          <Field label="URL CSV">
            <TextInput value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Button
            variant="primary"
            isDisabled={importM.isPending || comunas.length === 0}
            onPress={startUrlImport}
          >
            {importM.isPending
              ? "Procesando..."
              : `Importar ${comunas.length} comuna${comunas.length === 1 ? "" : "s"}`}
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
            disabled={importM.isPending || comunas.length === 0}
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
