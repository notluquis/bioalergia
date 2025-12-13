import type { ChangeEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import type { SupplyRequest } from "../types";
import { translateStatus } from "../utils";
import Input from "@/components/ui/Input";

interface SupplyRequestsTableProps {
  requests: SupplyRequest[];
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export default function SupplyRequestsTable({ requests, onStatusChange }: SupplyRequestsTableProps) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN", "GOD");

  return (
    <div className="bg-base-100 rounded-lg p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">{isAdmin ? "Todas las Solicitudes" : "Solicitudes Activas"}</h2>
      {requests.length === 0 ? (
        <p>No se encontraron solicitudes de insumos.</p>
      ) : (
        <div className="muted-scrollbar overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Insumo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Cantidad
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Marca/Modelo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Notas
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                  >
                    Solicitado Por
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Estado
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                  >
                    Notas del Admin
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                >
                  Fecha Solicitud
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider whitespace-nowrap text-gray-500 uppercase"
                  >
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-base-100 divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">{request.id}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{request.supply_name}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{request.quantity}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {request.brand && <span>{request.brand}</span>}
                    {request.brand && request.model && <span>/</span>}
                    {request.model && <span>{request.model}</span>}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{request.notes || "-"}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{request.user_email}</td>
                  )}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {translateStatus(request.status)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">{request.admin_notes || "-"}</td>
                  )}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
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
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="ordered">Pedido</option>
                        <option value="in_transit">En Tránsito</option>
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
