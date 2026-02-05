import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";

// Lazy load the feature page
const CounterpartsPage = lazy(() => import("@/features/counterparts/pages/CounterpartsPage"));

export default function CounterpartsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CounterpartsPage />
    </Suspense>
  );
}
