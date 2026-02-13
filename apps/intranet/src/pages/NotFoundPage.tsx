import { useLocation, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
export function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-warning/10 p-6 text-warning">
        <AlertTriangle size={48} />
      </div>
      <h1 className="mb-2 font-bold text-3xl text-foreground">Página no encontrada</h1>
      <p className="mb-8 max-w-md text-default-500">
        La ruta{" "}
        <code className="rounded bg-default-50 px-2 py-1 font-mono text-sm">
          {location.pathname}
        </code>{" "}
        no existe o no está disponible.
      </p>
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => {
            void navigate({ to: "/" });
          }}
        >
          <ArrowLeft size={18} />
          Volver
        </Button>
        <Button variant="primary" onClick={() => navigate({ to: "/" })}>
          <Home size={18} />
          Ir al Inicio
        </Button>
      </div>
    </div>
  );
}
