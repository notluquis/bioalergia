import type { SupplyRequest } from "./types";

export const translateStatus = (status: SupplyRequest["status"]) => {
  switch (status) {
    case "delivered": {
      return "Entregado";
    }
    case "in_transit": {
      return "En Tránsito";
    }
    case "ordered": {
      return "Pedido";
    }
    case "pending": {
      return "Pendiente";
    }
    case "rejected": {
      return "Rechazado";
    }
    default: {
      return status;
    }
  }
};
