import { Loader2 } from "lucide-react";
export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-default-50/50 shadow-inner">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/5" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="animate-pulse font-medium text-default-600 text-sm">Cargando...</p>
      </div>
    </div>
  );
}
