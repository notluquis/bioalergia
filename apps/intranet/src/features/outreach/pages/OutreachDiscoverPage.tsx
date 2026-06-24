import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useState } from "react";
import { SelectInput, TextInput } from "../components/FormField";
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
    if (!zonasQ.data) return;
    const zona = zonasQ.data.zonas[Number.parseInt(zonaIdx, 10)];
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

  const zonaOptions = zonasQ.data.zonas.map((z, i) => ({
    value: String(i),
    label: `${z.nombre} (${z.ciudad}) · ${z.radio / 1000} km`,
  }));
  const categoriaOptions = [
    { value: "", label: "— sin categoría (usar texto libre) —" },
    ...zonasQ.data.categorias.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Header>
          <Card.Title>Configuración de búsqueda</Card.Title>
          <Card.Description>
            Cada ejecución consulta Google Places para una zona + categoría. Los nuevos prospectos
            entran como tipo según categoría con estado SIN_CONTACTAR.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
          <SelectInput
            label="Zona"
            value={zonaIdx}
            onValueChange={setZonaIdx}
            options={zonaOptions}
          />
          <SelectInput
            label="Categoría Google Places"
            value={tipo}
            onValueChange={setTipo}
            options={categoriaOptions}
          />
          <div className="md:col-span-2">
            <TextInput
              label="Texto libre (opcional, ej: 'industria')"
              value={textQuery}
              onValueChange={setTextQuery}
            />
          </div>
          <TextInput
            label="Máx. resultados"
            type="number"
            min={1}
            max={60}
            value={maxResults}
            onValueChange={(v) => setMaxResults(Number.parseInt(v || "20", 10))}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Content className="flex items-center gap-3 p-4">
          <Button
            variant="primary"
            isDisabled={discover.isPending || (!tipo && !textQuery)}
            onPress={() => {
              void run();
            }}
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
