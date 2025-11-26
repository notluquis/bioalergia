import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-warning/10 p-6 text-warning">
        <AlertTriangle size={48} />
      </div>
      <h1 className="mb-2 text-3xl font-bold text-base-content">Página no encontrada</h1>
      <p className="mb-8 max-w-md text-base-content/60">
        La ruta <code className="rounded bg-base-200 px-2 py-1 font-mono text-sm">{location.pathname}</code> no existe o
        no está disponible.
      </p>
      <div className="flex gap-4">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Volver
        </button>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          <Home size={18} />
          Ir al Inicio
        </button>
      </div>
    </div>
  );
}
