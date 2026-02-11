import { Lock } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/context/AuthContext";
import { ServicesCreateContent } from "@/features/services/components/ServicesCreateContent";
export function ServicesCreatePage() {
  const { can } = useAuth();
  const canCreate = can("create", "Service");

  if (!canCreate) {
    return (
      <div className="container mx-auto p-6">
        <Alert status="warning">
          <Lock className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-bold">Acceso restringido</span>
            <span>No tienes permisos para crear nuevos servicios.</span>
          </div>
        </Alert>
      </div>
    );
  }

  return <ServicesCreateContent />;
}
