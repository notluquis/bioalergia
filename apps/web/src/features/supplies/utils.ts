import type { SupplyRequest } from "./types";

export const translateStatus = (status: SupplyRequest["status"]) => {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "ordered":
      return "Pedido";
    case "in_transit":
      return "En Tránsito";
    case "delivered":
      return "Entregado";
    case "rejected":
      return "Rechazado";
    default:
      return status;
  }
};
