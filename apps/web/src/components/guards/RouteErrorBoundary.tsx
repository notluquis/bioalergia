import { AlertTriangle, Home, LogIn, RefreshCw } from "lucide-react";
import { lazy, Suspense } from "react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

import Button from "@/components/ui/Button";
import NotFoundPage from "@/pages/NotFoundPage";

const ChunkLoadErrorPage = lazy(() => import("@/pages/ChunkLoadErrorPage"));

export default function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  console.error("Route Error:", error);

  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  // 1. Check for chunk load errors (Deployment updates)
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type/i.test(
      errorMessage
    )
  ) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
        <ChunkLoadErrorPage />
      </Suspense>
    );
  }

  // 2. Handle React Router specific errors (404, 401, 503, etc.)
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return <NotFoundPage />;
    }

    if (error.status === 401) {
      return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
          <div className="bg-warning/10 text-warning mb-6 rounded-full p-6">
            <LogIn size={48} />
          </div>
          <h1 className="text-base-content mb-2 text-3xl font-bold">Sesión Expirada</h1>
          <p className="text-base-content/60 mb-8 max-w-md">
            Tu sesión ha caducado o no tienes permisos para ver esta página. Por favor, inicia sesión nuevamente.
          </p>
          <Button onClick={() => navigate("/login")}>Ir al Login</Button>
        </div>
      );
    }

    if (error.status === 503) {
      return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
          <div className="bg-error/10 text-error mb-6 rounded-full p-6">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-base-content mb-2 text-3xl font-bold">Servicio No Disponible</h1>
          <p className="text-base-content/60 mb-8 max-w-md">
            Estamos realizando tareas de mantenimiento. Por favor, intenta nuevamente en unos minutos.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
        <div className="bg-error/10 text-error mb-6 rounded-full p-6">
          <AlertTriangle size={48} />
        </div>
        <h1 className="text-base-content mb-2 text-3xl font-bold">
          {error.status} {error.statusText}
        </h1>
        <p className="text-base-content/60 mb-8 max-w-md">
          {error.data?.message || "Ha ocurrido un error inesperado."}
        </p>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Volver
          </Button>
          <Button onClick={() => navigate("/")}>Ir al Inicio</Button>
        </div>
      </div>
    );
  }

  // 3. Handle Generic/Unexpected Errors
  return (
    <div className="bg-base-100 flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="bg-error/10 text-error mx-auto flex h-20 w-20 items-center justify-center rounded-full">
          <AlertTriangle size={40} />
        </div>

        <div className="space-y-2">
          <h1 className="text-base-content text-3xl font-bold">Algo salió mal</h1>
          <p className="text-base-content/60">Ha ocurrido un error inesperado en la aplicación.</p>
        </div>

        <div className="bg-base-200 rounded-xl p-4 text-left">
          <p className="text-error font-mono text-xs break-all">{errorMessage}</p>
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar página
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/")}>
            <Home className="mr-2 h-4 w-4" />
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
