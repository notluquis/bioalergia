import React from "react";
import { useAuth } from "../context/AuthContext";
import SupplyRequestForm from "../features/supplies/components/SupplyRequestForm";
import SupplyRequestsTable from "../features/supplies/components/SupplyRequestsTable";
import { useSupplyManagement } from "../features/supplies/hooks/useSupplyManagement";
import Alert from "../components/Alert";

export default function Supplies() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "GOD";

  const { requests, commonSupplies, loading, error, successMessage, fetchData, handleStatusChange } =
    useSupplyManagement();

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Solicitudes de Insumos</h1>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={fetchData} />

      <SupplyRequestsTable requests={requests} onStatusChange={handleStatusChange} />
    </div>
  );
}
