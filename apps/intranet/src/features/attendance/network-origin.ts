type AttendanceMarkNetworkLike = {
  connectionType: null | string;
  createdByUserId: null | number;
  ipAddress: null | string;
  isOfficeNetwork: boolean;
  latitude: null | number;
  longitude: null | number;
};

export type AttendanceNetworkOrigin = {
  description: string;
  label: string;
  tone: "default" | "success" | "warning";
};

function normalizeConnectionType(value: null | string): string {
  return (value ?? "").trim().toLowerCase();
}

export function getAttendanceNetworkOrigin(
  mark: AttendanceMarkNetworkLike | null | undefined
): AttendanceNetworkOrigin {
  if (!mark) {
    return {
      description: "Aun no hay una marca registrada para evaluar el origen.",
      label: "Sin marca",
      tone: "default",
    };
  }

  if (mark.isOfficeNetwork) {
    return {
      description: "La IP coincide con una red interna registrada como oficina.",
      label: "Oficina",
      tone: "success",
    };
  }

  if (
    mark.createdByUserId !== null &&
    mark.ipAddress === null &&
    mark.latitude === null &&
    mark.longitude === null
  ) {
    return {
      description: "La marca fue creada manualmente por un administrador.",
      label: "Correccion admin",
      tone: "default",
    };
  }

  if (mark.ipAddress === null) {
    return {
      description: "No se pudo detectar una IP valida al momento de registrar la marca.",
      label: "Sin red detectable",
      tone: "default",
    };
  }

  const connectionType = normalizeConnectionType(mark.connectionType);
  if (connectionType.includes("wifi") || connectionType.includes("wi-fi")) {
    return {
      description: "La marca se hizo fuera de la oficina usando una red Wi-Fi externa.",
      label: "Wi-Fi externa",
      tone: "warning",
    };
  }
  if (
    connectionType.includes("cell") ||
    connectionType.includes("mobile") ||
    connectionType.includes("4g") ||
    connectionType.includes("5g") ||
    connectionType.includes("3g")
  ) {
    return {
      description: "La marca se hizo usando datos moviles fuera de la oficina.",
      label: "Movil externa",
      tone: "warning",
    };
  }

  return {
    description: "La marca proviene de una IP que no coincide con las redes internas registradas.",
    label: "Red externa",
    tone: "warning",
  };
}
