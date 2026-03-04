import { Card, Description, Spinner } from "@heroui/react";
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Card className="rounded-2xl p-4" variant="secondary">
        <Card.Content className="flex flex-col items-center gap-2 p-0">
          <Spinner aria-label="Cargando" color="accent" size="lg" />
          <Description className="font-medium text-default-600 text-sm">Cargando...</Description>
        </Card.Content>
      </Card>
    </div>
  );
}
