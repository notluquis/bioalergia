import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";

import type { SupplyRequest } from "../types";
import { translateStatus } from "../utils";

interface SupplyRequestsTableProps {
  requests: SupplyRequest[];
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export default function SupplyRequestsTable({ requests, onStatusChange }: SupplyRequestsTableProps) {
  const { can } = useAuth();
  const isAdmin = can("update", "SupplyRequest");

  return (
    <div className="bg-base-100 rounded-lg p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">{isAdmin ? "Todas las solicitudes" : "Solicitudes activas"}</h2>
      {requests.length === 0 ? (
        <p>No se encontraron solicitudes de insumos.</p>
      ) : (
        <div className="muted-scrollbar overflow-x-auto">
          <table className="divide-base-300 min-w-full divide-y">
            <thead className="bg-base-200/50">
              <tr>
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  ID
                </th>
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Insumo
                </th>
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Cantidad
                </th>
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Marca/modelo
                </th>
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Notas
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                  >
                    Solicitado por
                  </th>
                )}
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Estado
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                  >
                    Notas del admin
                  </th>
                )}
                <th
                  scope="col"
                  className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                >
                  Fecha solicitud
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="text-base-content/70 px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap uppercase"
                  >
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-base-100 divide-base-300 divide-y">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="text-base-content px-6 py-4 text-sm font-medium whitespace-nowrap">{request.id}</td>
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">{request.supply_name}</td>
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">{request.quantity}</td>
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">
                    {request.brand && <span>{request.brand}</span>}
                    {request.brand && request.model && <span>/</span>}
                    {request.model && <span>{request.model}</span>}
                  </td>
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">{request.notes || "-"}</td>
                  {isAdmin && (
                    <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">{request.user_email}</td>
                  )}
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">
                    {translateStatus(request.status)}
                  </td>
                  {isAdmin && (
                    <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">
                      {request.admin_notes || "-"}
                    </td>
                  )}
                  <td className="text-base-content/70 px-6 py-4 text-sm whitespace-nowrap">
                    {new Date(request.created_at).toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <Input
                        as="select"
                        value={request.status}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onStatusChange(request.id, event.target.value as SupplyRequest["status"])
                        }
                        className="border-base-300 bg-base-100 mt-1 block w-full rounded-md py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="ordered">Pedido</option>
                        <option value="in_transit">En tránsito</option>
                        <option value="delivered">Entregado</option>
                        <option value="rejected">Rechazado</option>
                      </Input>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
