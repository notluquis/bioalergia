import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4">
      <div className="bg-default-50/50 relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <div className="bg-primary/5 absolute inset-0 animate-pulse rounded-2xl" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-default-600 animate-pulse text-sm font-medium">Cargando...</p>
      </div>
    </div>
  );
}
