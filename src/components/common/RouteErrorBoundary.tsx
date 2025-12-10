import { useRouteError, isRouteErrorResponse } from "react-router-dom";
import ChunkLoadErrorPage from "@/pages/ChunkLoadErrorPage";
import Button from "@/components/ui/Button";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  console.error("Route Error:", error);

  const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";

  // Check for chunk load errors
  if (
    /Failed to fetch dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type/i.test(
      errorMessage
    )
  ) {
    return <ChunkLoadErrorPage />;
  }

  return (
    <div className="bg-base-100 flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="bg-error/10 text-error mx-auto flex h-20 w-20 items-center justify-center rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-base-content text-3xl font-bold">Algo salió mal</h1>
          <p className="text-base-content/60">
            {isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : "Ha ocurrido un error inesperado."}
          </p>
        </div>

        <div className="bg-base-200 rounded-xl p-4 text-left">
          <p className="text-error font-mono text-xs break-all">{errorMessage}</p>
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={() => window.location.reload()}>Recargar página</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/")}>
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
