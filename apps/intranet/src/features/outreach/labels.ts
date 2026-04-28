import type {
  OutreachCampaignStatus,
  OutreachDependencia,
  OutreachDeliveryStatus,
  OutreachInteractionType,
  OutreachPriority,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";

export const ESTADO_LABELS: Record<OutreachStatus, string> = {
  SIN_CONTACTAR: "Sin contactar",
  CONTACTADO: "Contactado",
  SIN_RESPUESTA: "Sin respuesta",
  RESPONDIO_INTERES: "Interés",
  RESPONDIO_MAS_INFO: "Pidió más info",
  RESPONDIO_DESISTIO: "Desistió",
  REUNION_AGENDADA: "Reunión agendada",
  CONVENIO_FIRMADO: "Convenio firmado",
  DESCARTADO: "Descartado",
};

export const ESTADO_COLOR: Record<
  OutreachStatus,
  "default" | "primary" | "warning" | "success" | "danger"
> = {
  SIN_CONTACTAR: "default",
  CONTACTADO: "primary",
  SIN_RESPUESTA: "warning",
  RESPONDIO_INTERES: "success",
  RESPONDIO_MAS_INFO: "primary",
  RESPONDIO_DESISTIO: "danger",
  REUNION_AGENDADA: "success",
  CONVENIO_FIRMADO: "success",
  DESCARTADO: "danger",
};

export const DEPENDENCIA_LABELS: Record<OutreachDependencia, string> = {
  MUNICIPAL: "Municipal",
  PARTICULAR_SUBVENCIONADO: "Part. Subvencionado",
  PARTICULAR_PAGADO: "Part. Pagado",
  SLEP: "SLEP",
  CORPORACION_MUNICIPAL: "Corp. Municipal",
  OTRO: "Otro",
};

export const PRIORIDAD_LABELS: Record<OutreachPriority, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const PRIORIDAD_COLOR: Record<
  OutreachPriority,
  "default" | "primary" | "warning" | "danger"
> = {
  ALTA: "danger",
  MEDIA: "warning",
  BAJA: "default",
};

export const INTERACCION_LABELS: Record<OutreachInteractionType, string> = {
  EMAIL_ENVIADO: "Email enviado",
  EMAIL_RECIBIDO: "Email recibido",
  LLAMADA_REALIZADA: "Llamada realizada",
  LLAMADA_RECIBIDA: "Llamada recibida",
  WHATSAPP: "WhatsApp",
  REUNION_PRESENCIAL: "Reunión presencial",
  REUNION_ONLINE: "Reunión online",
  CHARLA_REALIZADA: "Charla realizada",
  NOTA_INTERNA: "Nota interna",
};

export const CAMPAIGN_STATUS_LABELS: Record<OutreachCampaignStatus, string> = {
  BORRADOR: "Borrador",
  REVISION: "Revisión",
  ENVIANDO: "Enviando",
  COMPLETADA: "Completada",
  PAUSADA: "Pausada",
  CANCELADA: "Cancelada",
};

export const DELIVERY_STATUS_LABELS: Record<OutreachDeliveryStatus, string> = {
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  ERROR: "Error",
  REBOTADO: "Rebotado",
  ABIERTO: "Abierto",
  RESPONDIDO: "Respondido",
};
