import { useLocation, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import Button from "@/components/ui/Button";

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="bg-warning/10 text-warning mb-6 rounded-full p-6">
        <AlertTriangle size={48} />
      </div>
      <h1 className="text-base-content mb-2 text-3xl font-bold">Página no encontrada</h1>
      <p className="text-base-content/60 mb-8 max-w-md">
        La ruta{" "}
        <code className="bg-base-200 rounded px-2 py-1 font-mono text-sm">{location.pathname}</code>{" "}
        no existe o no está disponible.
      </p>
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => {
            globalThis.history.back();
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
