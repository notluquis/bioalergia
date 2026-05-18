import { Card, Chip, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { haulmerDteClient } from "@/features/haulmer-dte/orpc";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function HaulmerDtePage() {
  const taxpayerQ = useQuery({
    queryKey: ["haulmer-dte", "taxpayer"],
    queryFn: () => haulmerDteClient.taxpayer(),
    staleTime: 1000 * 60 * 60,
  });
  const ufQ = useQuery({
    queryKey: ["haulmer-dte", "uf"],
    queryFn: () => haulmerDteClient.uf(),
    staleTime: 1000 * 60 * 60,
  });
  const foliosQ = useQuery({
    queryKey: ["haulmer-dte", "folios"],
    queryFn: () => haulmerDteClient.folios(),
    staleTime: 1000 * 60 * 5,
  });
  const emittedQ = useQuery({
    queryKey: ["haulmer-dte", "emitted", 39],
    queryFn: () => haulmerDteClient.emitted({ dte_type: 39, page: 1, limit: 15 }),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-bold text-3xl">Haulmer DTE</h1>
        <p className="text-foreground/60 text-sm">
          Folios disponibles + últimos documentos emitidos. Emisión post-venta automática vía
          checkout.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Contribuyente</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-1 text-sm">
            {taxpayerQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : taxpayerQ.data ? (
              <>
                <p className="font-semibold">{taxpayerQ.data.data.razon_social}</p>
                <p className="text-foreground/60">
                  RUT {taxpayerQ.data.data.rut}-{taxpayerQ.data.data.dv}
                </p>
                <p className="text-foreground/60">{taxpayerQ.data.data.giro}</p>
                <p className="text-foreground/60">
                  {taxpayerQ.data.data.direccion} · {taxpayerQ.data.data.comuna_nombre}
                </p>
              </>
            ) : (
              <p className="text-danger">Error cargando</p>
            )}
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>UF actual</Card.Title>
          </Card.Header>
          <Card.Content>
            {ufQ.isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : ufQ.data ? (
              <p className="font-bold text-3xl">{CLP.format(ufQ.data.data.valor)}</p>
            ) : (
              <p className="text-danger">Error</p>
            )}
          </Card.Content>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-xl">Folios disponibles</h2>
        {foliosQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : foliosQ.data ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {foliosQ.data.data.map((f) => (
              <Card key={f.dte}>
                <Card.Content className="space-y-1 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{f.tipo}</p>
                    <Chip
                      color={f.disponibles <= f.alerta ? "warning" : "success"}
                      size="sm"
                      variant="soft"
                    >
                      {f.disponibles} disp
                    </Chip>
                  </div>
                  <p className="text-foreground/60 text-xs">
                    Siguiente folio: <span className="font-mono">{f.siguiente}</span>
                  </p>
                </Card.Content>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-danger">Error</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-xl">Últimas boletas emitidas</h2>
        {emittedQ.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : emittedQ.data ? (
          <Card>
            <Card.Content className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-default text-foreground/70 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Folio</th>
                    <th className="px-3 py-2 text-left">Receptor</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {emittedQ.data.data.map((d) => (
                    <tr className="border-foreground/10 border-t" key={`${d.TipoDTE}-${d.Folio}`}>
                      <td className="px-3 py-2 font-mono">{d.Folio}</td>
                      <td className="px-3 py-2">{d.RznSocRecep ?? "—"}</td>
                      <td className="px-3 py-2">{d.FchEmis}</td>
                      <td className="px-3 py-2 text-right">{CLP.format(d.MntTotal)}</td>
                      <td className="px-3 py-2">
                        <Chip color="success" size="sm" variant="soft">
                          {d.RevisionDetalle}
                        </Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card.Content>
          </Card>
        ) : (
          <p className="text-danger">Error</p>
        )}
      </section>
    </div>
  );
}
