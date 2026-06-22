// Contenido B2B de la página /venta-empresas.
// Bioalergia revende el catálogo de Inmunodiagnóstico (alianza co-branded:
// el director médico de Bioalergia es socio del dueño de Inmunodiagnóstico).
// Esta data es estática e informativa; los productos navegables con precio
// interno viven en la vitrina (QuoteProduct, publishedOnSite) servida por la API.
//
// Fuente: inmunodiagnostico.cl (catálogo, droguería, capacitaciones,
// sobre-inmunodiagnostico). Verificado 2026-06-21.

export type ReactivoSupplier = {
  name: string;
  yearsTrajectory: number;
  description: string;
  certifications: string[];
  regulatory: string[];
  sustainability: string[];
};

/**
 * Proveedor mayorista detrás de la oferta B2B de Bioalergia. Solo credenciales
 * institucionales: el contacto comercial siempre es Bioalergia (form de leads),
 * por eso no exponemos direcciones/teléfonos del proveedor.
 */
export const reactivosSupplier: ReactivoSupplier = {
  name: "Inmunodiagnóstico",
  yearsTrajectory: 25,
  description:
    "Trabajamos en alianza con Inmunodiagnóstico, droguería y distribuidora chilena con más de 25 años de trayectoria en soluciones de diagnóstico, dispositivos médicos y reactivos para los sectores clínico, forense, de ciencias biológicas y ambiental.",
  certifications: ["ISO 9001:2015 (vigente desde 2019)", "Estándares ISO · CE · FDA"],
  regulatory: [
    "Autorización ISP (Instituto de Salud Pública de Chile)",
    "Droguería autorizada — Resolución Ex. E 3669/25",
    "Cumplimiento Decreto 825 (control de productos médicos)",
    "Buenas Prácticas de Almacenamiento y Distribución (BPAD)",
  ],
  sustainability: [
    "Flota de vehículos eléctricos para una logística de bajas emisiones.",
    "Alianza con Fundación San José para reciclaje y economía circular.",
    "Distribución gratuita de tests para programas de salud y reinserción.",
  ],
};

/** Marcas representadas en el catálogo. */
export const reactivosBrands: string[] = [
  "Roxall",
  "Cerilliant",
  "Merck",
  "UTAK",
  "Mindray",
  "SYSMEX",
  "Abbott",
  "RapidLabs",
];

// Las categorías y productos NO se hardcodean: viven en la vitrina (QuoteProduct,
// publishedOnSite) y la página los deriva agrupando los ítems que entrega la API.
// Esto mantiene el catálogo 100% en DB; lo de arriba es solo framing institucional.

export type ReactivoService = {
  slug: string;
  name: string;
  description: string;
  details: string[];
};

/** Servicios del proveedor que Bioalergia ofrece a empresas. */
export const reactivosServices: ReactivoService[] = [
  {
    slug: "drogueria",
    name: "Droguería",
    description:
      "Almacenamiento, distribución y transporte de productos farmacéuticos y dispositivos médicos bajo estrictos estándares de calidad y trazabilidad.",
    details: [
      "Droguería autorizada (Res. Ex. E 3669/25).",
      "Buenas Prácticas de Almacenamiento y Distribución.",
      "Cadena de frío y trazabilidad garantizada.",
    ],
  },
  {
    slug: "distribucion-insumos",
    name: "Distribución de insumos",
    description:
      "Distribución de insumos y reactivos para laboratorio clínico, forense, ciencias biológicas y ambiental, con proveedores nacionales e internacionales.",
    details: [
      "Laboratorio clínico y forense.",
      "Ciencias biológicas y ambiental.",
      "Logística con flota propia de bajas emisiones.",
    ],
  },
  {
    slug: "capacitaciones",
    name: "Capacitaciones",
    description:
      "Programas de capacitación en uso de equipos y diagnóstico para equipos clínicos y de laboratorio.",
    details: [
      "Operación de equipos (Q-SMART, D-10 POCT).",
      "Diagnóstico de alergias y drogas de abuso.",
      "Diagnóstico in vitro de enfermedades infecciosas.",
    ],
  },
  {
    slug: "servicio-tecnico",
    name: "Servicio técnico y consultoría",
    description:
      "Soporte técnico de equipos y consultoría sobre calidad de productos diagnósticos.",
    details: [
      "Asesoría en calidad de producto.",
      "Soporte y mantención de equipos.",
      "Acompañamiento post-venta.",
    ],
  },
];

export type ReactivoTraining = {
  name: string;
  topic: "Equipos" | "Alergias" | "Enf. infecciosas" | "Drogas de abuso";
};

/** Catálogo de capacitaciones del proveedor. */
export const reactivosTrainings: ReactivoTraining[] = [
  { name: "Uso de equipo Q-SMART", topic: "Equipos" },
  { name: "Uso de equipo D-10 (POCT)", topic: "Equipos" },
  { name: "DMDIV para infecciones respiratorias", topic: "Enf. infecciosas" },
  { name: "DMDIV de enfermedades infecciosas", topic: "Enf. infecciosas" },
  { name: "Diagnóstico de alergias", topic: "Alergias" },
  { name: "Drogas de abuso", topic: "Drogas de abuso" },
  { name: "DMDIV utilizados en salud sexual", topic: "Drogas de abuso" },
];
