import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useState } from "react";
import { Field, NativeSelect, TextInput } from "../components/FormField";
import { useDiscoverGooglePlaces, useZonas } from "../hooks/useOutreach";

export function OutreachDiscoverPage() {
  const zonasQ = useZonas();
  const discover = useDiscoverGooglePlaces();
  const [zonaIdx, setZonaIdx] = useState("0");
  const [tipo, setTipo] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<
    Array<{ inserted: number; updated: number; found: number; errors: number; label: string }>
  >([]);

  const run = async () => {
    const zona = zonasQ.data?.zonas[Number.parseInt(zonaIdx, 10)];
    if (!zona) return;
    const r = await discover.mutateAsync({
      zonaIndex: Number.parseInt(zonaIdx, 10),
      type: tipo || undefined,
      textQuery: textQuery.trim() || undefined,
      maxResults,
    });
    setResults((prev) => [
      {
        inserted: r.inserted,
        updated: r.updated,
        found: r.found,
        errors: r.errors,
        label: `${zona.nombre} · ${tipo || textQuery || "all"}`,
      },
      ...prev,
    ]);
  };

  if (zonasQ.isLoading || !zonasQ.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="font-bold text-2xl">Descubrir empresas (Google Places)</h1>
        <p className="text-default-500 text-sm">
          Cada ejecución consulta Google Places para una zona + categoría. Los prospectos nuevos
          entran como <code>EMPRESA</code> con estado <code>SIN_CONTACTAR</code>. Confirma cada
          ejecución manualmente.
        </p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>Configuración de búsqueda</Card.Title>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <Field label="Zona">
            <NativeSelect value={zonaIdx} onChange={(e) => setZonaIdx(e.target.value)}>
              {zonasQ.data.zonas.map((z, i) => (
                <option key={i} value={String(i)}>
                  {z.nombre} ({z.ciudad}) · {z.radio / 1000} km
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Categoría Google Places">
            <NativeSelect value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">— sin categoría (usa textQuery) —</option>
              {zonasQ.data.categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="md:col-span-2">
            <Field label="Texto libre (opcional, ej: 'industria')">
              <TextInput value={textQuery} onChange={(e) => setTextQuery(e.target.value)} />
            </Field>
          </div>
          <Field label="Máx. resultados">
            <TextInput
              type="number"
              min={1}
              max={60}
              value={maxResults}
              onChange={(e) => setMaxResults(Number.parseInt(e.target.value || "20", 10))}
            />
          </Field>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="flex items-center gap-3 p-4">
          <Button
            variant="primary"
            isDisabled={discover.isPending || (!tipo && !textQuery)}
            onPress={run}
          >
            {discover.isPending ? "Buscando..." : "Ejecutar búsqueda"}
          </Button>
          {discover.isError && (
            <span className="text-danger text-sm">
              {(discover.error as Error)?.message ?? "Error"}
            </span>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Historial de ejecuciones (sesión)</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2 p-4">
          {results.length === 0 ? (
            <p className="text-default-500 text-sm">Sin ejecuciones aún.</p>
          ) : (
            results.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-default-100 p-2 text-sm"
              >
                <span>{r.label}</span>
                <div className="flex gap-2">
                  <Chip size="sm" color="success" variant="soft">
                    +{r.inserted} nuevos
                  </Chip>
                  <Chip size="sm" variant="soft">
                    {r.updated} actualizados
                  </Chip>
                  {r.errors > 0 && (
                    <Chip size="sm" color="danger" variant="soft">
                      {r.errors} errores
                    </Chip>
                  )}
                </div>
              </div>
            ))
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
