export function ExpensePlaceholder() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-default-200 border-dashed bg-background p-8 text-center opacity-70">
      <h3 className="font-semibold text-lg">Gestión de Gastos</h3>
      <p className="mt-2 max-w-md text-default-500">
        Muy pronto podrás registrar y categorizar los gastos manualmente aquí. Por ahora, esta
        sección es demostrativa.
      </p>
    </div>
  );
}
