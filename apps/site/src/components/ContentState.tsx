import { Card, Skeleton } from "@heroui/react";

/** Skeleton shown while a content block loads. */
export function ContentLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Cargando contenido">
      <div className="grid gap-3">
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-10 w-2/3 rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton className="h-40 w-full rounded-3xl" key={i} />
        ))}
      </div>
    </div>
  );
}

/** Friendly fallback when a content block fails to load. */
export function ContentError() {
  return (
    <Card className="rounded-3xl" variant="secondary">
      <Card.Header className="gap-2">
        <Card.Title className="text-lg">No pudimos cargar esta sección</Card.Title>
        <Card.Description className="text-(--ink-muted) leading-relaxed">
          Hubo un problema al cargar el contenido. Vuelve a intentarlo en unos minutos o
          escríbenos si el problema persiste.
        </Card.Description>
      </Card.Header>
    </Card>
  );
}
