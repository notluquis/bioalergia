import type { ChangeEvent } from "react";
import { useAuth } from "../../../context/AuthContext";
import type { SupplyRequest } from "../types";
import { translateStatus } from "../utils";
import Input from "../../../components/ui/Input";

interface SupplyRequestsTableProps {
  requests: SupplyRequest[];
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export default function SupplyRequestsTable({ requests, onStatusChange }: SupplyRequestsTableProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "GOD";

  return (
    <div className="p-6 bg-base-100 shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-4">{isAdmin ? "Todas las Solicitudes" : "Solicitudes Activas"}</h2>
      {requests.length === 0 ? (
        <p>No se encontraron solicitudes de insumos.</p>
      ) : (
        <div className="overflow-x-auto muted-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Insumo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Cantidad
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Marca/Modelo
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Notas
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    Solicitado Por
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Estado
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    Notas del Admin
                  </th>
                )}
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  Fecha Solicitud
                </th>
                {isAdmin && (
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-base-100 divide-y divide-gray-200">
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.supply_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.quantity}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.brand && <span>{request.brand}</span>}
                    {request.brand && request.model && <span>/</span>}
                    {request.model && <span>{request.model}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.notes || "-"}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.user_email}</td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {translateStatus(request.status)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.admin_notes || "-"}</td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(request.created_at).toLocaleString()}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Input
                        as="select"
                        value={request.status}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                          onStatusChange(request.id, event.target.value as SupplyRequest["status"])
                        }
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
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
