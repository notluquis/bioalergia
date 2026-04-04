import { contactInfo } from "@/data/clinic";

export type LegalDocumentKey = "dataDeletion" | "privacy" | "terms";

export interface LegalDocumentReference {
  href: string;
  label: string;
  note?: string;
}

export interface LegalDocumentSection {
  bullets?: string[];
  id: string;
  paragraphs?: string[];
  title: string;
}

export interface LegalDocument {
  canonicalPath: string;
  chips: string[];
  effectiveDate: string;
  eyebrow: string;
  highlights: Array<{ label: string; value: string }>;
  lastUpdated: string;
  references: LegalDocumentReference[];
  sections: LegalDocumentSection[];
  seoDescription: string;
  seoTitle: string;
  summary: string;
  title: string;
}

export const legalOwner = {
  address: contactInfo.address,
  companyName: "Bioalergia SpA",
  country: "Chile",
  email: contactInfo.email,
  privacyEmail: contactInfo.email,
  supportEmail: contactInfo.email,
};

const lastUpdated = "4 de abril de 2026";

export const legalDocuments: Record<LegalDocumentKey, LegalDocument> = {
  privacy: {
    canonicalPath: "/privacy",
    chips: ["Chile", "Datos personales", "Salud"],
    effectiveDate: lastUpdated,
    eyebrow: "Política de Privacidad",
    highlights: [
      { label: "Responsable", value: legalOwner.companyName },
      { label: "Contacto", value: legalOwner.privacyEmail },
      { label: "Jurisdicción", value: legalOwner.country },
      { label: "Datos sensibles", value: "Tratamiento restringido" },
    ],
    lastUpdated,
    references: [
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=141599",
        label: "Ley Nº 19.628 sobre protección de la vida privada",
      },
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1039348",
        label: "Ley Nº 20.584 sobre derechos y deberes en salud",
      },
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1046753",
        label: "Decreto Nº 41 del Ministerio de Salud sobre ficha clínica",
      },
      {
        href: "https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13",
        label: "Ley Nº 21.719, publicada el 13 de diciembre de 2024",
        note: "Su entrada en vigencia general fue fijada para el 1 de diciembre de 2026.",
      },
    ],
    sections: [
      {
        id: "responsable",
        paragraphs: [
          `${legalOwner.companyName}, con domicilio de referencia en ${legalOwner.address}, es responsable del tratamiento de los datos personales recabados a través de bioalergia.cl y de los canales digitales vinculados desde este sitio.`,
          "Esta política aplica al sitio web, formularios y medios de contacto publicados en el sitio, derivaciones a agenda online, comunicaciones por correo electrónico o WhatsApp iniciadas desde estos canales, y registros técnicos necesarios para operar y proteger la plataforma.",
        ],
        title: "1. Responsable y alcance",
      },
      {
        id: "datos-que-tratamos",
        bullets: [
          "Datos de identificación y contacto, como nombre, teléfono, correo electrónico y otros datos que tú nos entregues.",
          "Datos de agenda o coordinación, como fecha solicitada, especialidad, profesional, canal de contacto preferido y antecedentes necesarios para gestionar tu atención.",
          "Datos de salud o datos sensibles sólo cuando tú los proporciones o cuando sean necesarios para la coordinación, continuidad o seguridad de la atención.",
          "Datos técnicos y de navegación, como dirección IP, navegador, dispositivo, cookies estrictamente necesarias y eventos básicos de seguridad o analítica.",
        ],
        title: "2. Datos que podemos tratar",
      },
      {
        id: "finalidades-y-bases",
        paragraphs: [
          "Tratamos datos para responder consultas, coordinar horas, confirmar o reprogramar atenciones, dar continuidad operativa a la relación asistencial, resguardar seguridad clínica y administrativa, y cumplir obligaciones legales y regulatorias aplicables en Chile.",
          "Cuando el tratamiento involucra datos de salud, aplicamos un estándar reforzado de necesidad, confidencialidad y minimización. Cuando el canal sea WhatsApp u otro servicio de terceros, además respetamos las reglas del proveedor sobre consentimiento y ventanas de conversación.",
          "La política está redactada considerando la Ley Nº 19.628 y la Ley Nº 20.584, y preparada para converger con el marco reforzado de la Ley Nº 21.719 una vez que entre en vigencia general.",
        ],
        title: "3. Finalidades y bases de tratamiento",
      },
      {
        id: "datos-sensibles",
        paragraphs: [
          "Los datos relativos a salud, antecedentes clínicos y otra información sensible se tratan con acceso restringido y sólo para fines compatibles con la atención, coordinación, continuidad asistencial, cumplimiento normativo, seguridad del paciente o protección jurídica de la prestación.",
          "No comercializamos datos de salud ni los utilizamos para perfiles publicitarios incompatibles con su finalidad original.",
        ],
        title: "4. Datos sensibles y reserva clínica",
      },
      {
        id: "comparticion",
        bullets: [
          "Prestadores tecnológicos que alojan, transmiten o protegen la infraestructura digital del sitio y sus comunicaciones.",
          "Plataformas de agenda o mensajería cuando tú decidas interactuar por esos medios.",
          "Asesores, proveedores y encargados que necesiten acceso acotado para prestar el servicio bajo deberes de confidencialidad y seguridad.",
          "Autoridades u organismos competentes cuando exista obligación legal, regulatoria o judicial.",
        ],
        paragraphs: [
          "Cuando un proveedor opere fuera de Chile, exigimos resguardos contractuales y organizacionales razonables acordes al tipo de datos y al riesgo involucrado.",
        ],
        title: "5. Comunicación a terceros y encargados",
      },
      {
        id: "conservacion",
        paragraphs: [
          "Conservamos los datos sólo por el tiempo necesario para cumplir la finalidad informada, resguardar continuidad operativa, atender requerimientos legales o regulatorios, mantener evidencia de consentimientos o resolver contingencias de seguridad y auditoría.",
          "Si ciertos antecedentes forman parte de registros clínicos o administrativos sujetos a conservación obligatoria, podremos bloquear, restringir o archivar su tratamiento en vez de eliminarlos inmediatamente.",
        ],
        title: "6. Conservación y eliminación",
      },
      {
        id: "derechos",
        bullets: [
          "Solicitar acceso a tus datos.",
          "Pedir rectificación o actualización cuando sean inexactos, incompletos o estén desactualizados.",
          "Solicitar supresión, bloqueo u oposición cuando corresponda legalmente.",
          "Revocar consentimientos opcionales y pedir el cese de comunicaciones no esenciales.",
          "Solicitar portabilidad o medidas equivalentes cuando el marco legal aplicable así lo permita.",
        ],
        paragraphs: [
          `Para ejercer estos derechos, escríbenos a ${legalOwner.privacyEmail}. Podemos solicitar antecedentes razonables para verificar identidad, representación o alcance del requerimiento.`,
        ],
        title: "7. Derechos de los titulares",
      },
      {
        id: "seguridad",
        paragraphs: [
          "Aplicamos medidas técnicas, organizacionales y contractuales razonables según la criticidad del canal y la naturaleza de los datos, incluyendo control de acceso, separación de entornos, registros operativos, validación de integridad, revisión de incidentes y deberes de confidencialidad.",
          "Ningún sistema conectado a internet puede garantizar riesgo cero, pero trabajamos bajo un criterio de minimización, necesidad y mejora continua.",
        ],
        title: "8. Seguridad de la información",
      },
      {
        id: "cookies",
        paragraphs: [
          "El sitio utiliza cookies y tecnologías equivalentes para operar funcionalidades básicas, medir rendimiento y mantener seguridad. No utilizamos este sitio para perfilar condiciones de salud con fines publicitarios incompatibles con la relación asistencial.",
          "Puedes gestionar cookies desde tu navegador, aunque algunas funciones podrían degradarse si bloqueas componentes estrictamente necesarios.",
        ],
        title: "9. Cookies y medición",
      },
      {
        id: "contacto-y-cambios",
        paragraphs: [
          `Si tienes preguntas sobre privacidad, escríbenos a ${legalOwner.privacyEmail}.`,
          "Podemos actualizar esta política para reflejar cambios operativos, normativos o de seguridad. La versión vigente será siempre la publicada en esta URL con su fecha de actualización.",
        ],
        title: "10. Contacto y cambios",
      },
    ],
    seoDescription:
      "Política de Privacidad de Bioalergia para bioalergia.cl y sus canales digitales, redactada para el marco chileno de datos personales y salud.",
    seoTitle: "Política de Privacidad | Bioalergia",
    summary:
      "Describe cómo Bioalergia trata datos personales y datos de salud en bioalergia.cl y en los canales digitales vinculados al sitio, bajo un estándar compatible con el marco chileno aplicable.",
    title: "Privacidad y protección de datos",
  },
  terms: {
    canonicalPath: "/terms",
    chips: ["Chile", "Sitio web", "Servicios de salud"],
    effectiveDate: lastUpdated,
    eyebrow: "Términos de Servicio",
    highlights: [
      { label: "Prestador", value: legalOwner.companyName },
      { label: "Canal", value: "bioalergia.cl" },
      { label: "Contacto", value: legalOwner.supportEmail },
      { label: "Ley aplicable", value: "República de Chile" },
    ],
    lastUpdated,
    references: [
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1039348",
        label: "Ley Nº 20.584 sobre derechos y deberes en salud",
      },
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=141599",
        label: "Ley Nº 19.628 sobre protección de la vida privada",
      },
    ],
    sections: [
      {
        id: "objeto",
        paragraphs: [
          "Estos términos regulan el acceso y uso del sitio bioalergia.cl. El sitio tiene fines informativos, de contacto, orientación general y coordinación de atenciones, y puede enlazar a plataformas externas de agenda o mensajería.",
          "Al usar el sitio aceptas estos términos en la medida permitida por la ley aplicable. Si no estás de acuerdo, debes abstenerte de usarlo.",
        ],
        title: "1. Objeto y aceptación",
      },
      {
        id: "alcance-clinico",
        paragraphs: [
          "El contenido del sitio no reemplaza una evaluación médica presencial o remota formal, ni constituye diagnóstico, tratamiento individualizado, indicación de urgencia o garantía de disponibilidad clínica inmediata.",
          "El sitio no debe utilizarse para emergencias. Ante una urgencia médica o síntomas graves, debes acudir al servicio de urgencia o sistema de emergencia correspondiente.",
        ],
        title: "2. Información médica y urgencias",
      },
      {
        id: "agenda-y-terceros",
        paragraphs: [
          "Determinadas gestiones pueden realizarse a través de terceros, como plataformas de agenda, correo electrónico o mensajería. Cuando uses esos servicios, también podrán aplicar sus propios términos, políticas y condiciones técnicas.",
          "Bioalergia no controla íntegramente las políticas ni la disponibilidad de servicios externos, aunque procura integrarlos de manera razonable y segura.",
        ],
        title: "3. Agenda, mensajería y servicios de terceros",
      },
      {
        id: "uso-aceptable",
        bullets: [
          "Entregar información veraz, suficiente y actualizada cuando uses formularios o canales de contacto.",
          "No suplantar a terceros ni intentar obtener acceso no autorizado a sistemas, datos o cuentas.",
          "No usar el sitio para cargas maliciosas, scraping abusivo, spam, ingeniería social o actividades contrarias a la ley.",
        ],
        title: "4. Uso permitido del sitio",
      },
      {
        id: "propiedad-intelectual",
        paragraphs: [
          "El diseño del sitio, textos, marcas, logotipos, piezas visuales y contenidos propios pertenecen a Bioalergia o a sus respectivos titulares. Su uso se autoriza sólo para fines personales, informativos y no comerciales, salvo autorización expresa.",
        ],
        title: "5. Propiedad intelectual",
      },
      {
        id: "disponibilidad",
        paragraphs: [
          "Bioalergia puede actualizar, corregir, suspender o modificar contenidos, canales o funcionalidades del sitio cuando resulte razonable por seguridad, mantención, evolución del servicio o cumplimiento normativo.",
          "Aunque hacemos esfuerzos razonables por mantener continuidad operativa, no garantizamos disponibilidad ininterrumpida ni ausencia absoluta de errores.",
        ],
        title: "6. Disponibilidad y cambios",
      },
      {
        id: "responsabilidad",
        paragraphs: [
          "En la máxima medida permitida por la ley, Bioalergia no será responsable por interrupciones, errores de terceros, indisponibilidad temporal de plataformas externas, ni por decisiones clínicas o personales adoptadas únicamente sobre la base de información general del sitio.",
          "Nada en estos términos limita derechos irrenunciables de consumidores, pacientes o titulares de datos reconocidos por la ley chilena aplicable.",
        ],
        title: "7. Responsabilidad y limitaciones",
      },
      {
        id: "privacidad",
        paragraphs: [
          "El tratamiento de datos personales y de salud se rige además por la Política de Privacidad publicada en este sitio. Si vas a enviarnos antecedentes sensibles, procura usar sólo los canales necesarios y evita compartir datos innecesarios.",
        ],
        title: "8. Privacidad",
      },
      {
        id: "ley-aplicable",
        paragraphs: [
          "Estos términos se interpretan conforme a la ley chilena. Cualquier controversia se resolverá por los mecanismos y ante las autoridades o tribunales competentes conforme a la normativa aplicable, sin perjuicio de foros especiales o derechos obligatorios establecidos por la ley.",
        ],
        title: "9. Ley aplicable y jurisdicción",
      },
      {
        id: "contacto",
        paragraphs: [
          `Para preguntas sobre estos términos, escríbenos a ${legalOwner.supportEmail}.`,
        ],
        title: "10. Contacto",
      },
    ],
    seoDescription:
      "Términos de Servicio de bioalergia.cl para uso del sitio, agenda online, canales de contacto y limitaciones propias de un sitio de salud en Chile.",
    seoTitle: "Términos de Servicio | Bioalergia",
    summary:
      "Regulan el uso de bioalergia.cl, los límites del contenido informativo, la coordinación de atenciones y el uso aceptable de los canales digitales asociados.",
    title: "Condiciones de uso del sitio",
  },
  dataDeletion: {
    canonicalPath: "/data-deletion",
    chips: ["Meta", "WhatsApp", "Chile"],
    effectiveDate: lastUpdated,
    eyebrow: "Data Deletion Instructions",
    highlights: [
      { label: "Solicitud", value: "Por correo electrónico" },
      { label: "Contacto", value: legalOwner.privacyEmail },
      { label: "Validación", value: "Verificación de identidad" },
      { label: "Resultado", value: "Eliminación, bloqueo o justificación legal" },
    ],
    lastUpdated,
    references: [
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=141599",
        label: "Ley Nº 19.628 sobre protección de la vida privada",
      },
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1039348",
        label: "Ley Nº 20.584 sobre derechos y deberes en salud",
      },
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1046753",
        label: "Decreto Nº 41 del Ministerio de Salud sobre ficha clínica",
      },
    ],
    sections: [
      {
        id: "alcance",
        paragraphs: [
          "Esta página explica cómo solicitar eliminación, bloqueo o supresión de datos personales tratados por Bioalergia a través de bioalergia.cl, formularios de contacto, agenda y canales digitales asociados, incluyendo integraciones con Meta o WhatsApp cuando corresponda.",
        ],
        title: "1. Alcance de esta URL",
      },
      {
        id: "que-puedes-pedir",
        bullets: [
          "Eliminación o anonimización de datos de contacto que ya no sean necesarios.",
          "Supresión de registros operativos o de mensajería cuando legalmente proceda.",
          "Cese de comunicaciones no esenciales o retiro de consentimiento en canales opcionales.",
          "Rectificación o actualización de datos incorrectos.",
          "Bloqueo o restricción del tratamiento cuando la eliminación inmediata no sea jurídicamente posible.",
        ],
        title: "2. Qué puedes solicitar",
      },
      {
        id: "como-solicitar",
        paragraphs: [
          `Envía un correo a ${legalOwner.privacyEmail} con el asunto “Solicitud de eliminación de datos” o similar.`,
          "Incluye, al menos: nombre completo, medio de contacto, canal involucrado, descripción precisa de lo que solicitas y los datos suficientes para ubicar el registro (por ejemplo, correo, teléfono, fecha aproximada o contexto de la interacción).",
          "Si la solicitud se relaciona con Meta o WhatsApp, indica además el número utilizado en WhatsApp y la fecha aproximada de la conversación o interacción.",
        ],
        title: "3. Cómo presentar la solicitud",
      },
      {
        id: "verificacion",
        paragraphs: [
          "Antes de ejecutar una eliminación podemos pedir verificación razonable de identidad o representación, especialmente si la solicitud involucra datos sensibles, antecedentes clínicos o información de terceros.",
        ],
        title: "4. Verificación de identidad",
      },
      {
        id: "limites",
        paragraphs: [
          "No siempre podremos borrar de inmediato toda la información. Si existen obligaciones legales, regulatorias, clínicas, contables, de seguridad o de resguardo probatorio, podremos conservar ciertos antecedentes por el tiempo exigido o necesario, limitando su uso al mínimo compatible con esa obligación.",
          "En esos casos podremos optar por bloqueo, archivo restringido, seudonimización o conservación segregada, en vez de eliminación total inmediata.",
        ],
        title: "5. Límites legales a la eliminación",
      },
      {
        id: "respuesta",
        paragraphs: [
          "Una vez revisada la solicitud, te informaremos si fue acogida, si requiere antecedentes adicionales o si existe una causal legal que impide la eliminación total. Cuando corresponda, confirmaremos la eliminación, anonimización o bloqueo aplicado.",
        ],
        title: "6. Cómo respondemos",
      },
      {
        id: "whatsapp-meta",
        paragraphs: [
          "Si sólo deseas dejar de recibir mensajes no esenciales por WhatsApp, también puedes solicitar opt-out por el mismo correo o por los canales de contacto publicados. La eliminación en nuestros sistemas no implica eliminación automática de información que haya sido tratada de manera independiente por Meta, WhatsApp, Doctoralia u otros terceros, cuyas políticas propias también pueden aplicar.",
        ],
        title: "7. Canal Meta / WhatsApp",
      },
      {
        id: "contacto",
        paragraphs: [
          `Contacto principal para estas solicitudes: ${legalOwner.privacyEmail}.`,
        ],
        title: "8. Contacto",
      },
    ],
    seoDescription:
      "Instrucciones de eliminación de datos de Bioalergia para Meta, WhatsApp y bioalergia.cl. Explica cómo solicitar supresión, bloqueo o corrección de datos.",
    seoTitle: "Eliminación de Datos | Bioalergia",
    summary:
      "Instrucciones para solicitar eliminación, bloqueo, rectificación o cese de tratamiento de datos personales en los canales digitales operados por Bioalergia.",
    title: "Instrucciones de eliminación de datos",
  },
};

