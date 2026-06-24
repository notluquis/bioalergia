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
  companyName: "DR. JOSÉ MANUEL MARTÍNEZ Y COMPAÑÍA LIMITADA",
  country: "Chile",
  email: contactInfo.email,
  privacyEmail: contactInfo.email,
  supportEmail: contactInfo.email,
  rut: "76.406.172-1",
  directorName: "Dr. José Manuel Martínez Martínez",
  dpoName: "Lucas Matías Pulgar Escobar",
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
      { label: "Delegado de datos", value: legalOwner.dpoName },
      { label: "Contacto", value: legalOwner.privacyEmail },
      { label: "Datos sensibles", value: "Salud (Ley 21.719)" },
    ],
    lastUpdated,
    references: [
      {
        href: "https://www.bcn.cl/leychile/navegar?idNorma=1209272",
        label: "Ley Nº 21.719 sobre protección y tratamiento de datos personales",
        note: "Su entrada en vigencia general fue fijada para el 1 de diciembre de 2026.",
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
        href: "/derechos",
        label: "Canal de ejercicio de derechos del titular",
        note: "Acceso, rectificación, supresión, oposición, portabilidad y bloqueo.",
      },
    ],
    sections: [
      {
        id: "objetivo-responsable",
        paragraphs: [
          `Bioalergia trata datos personales relativos a la salud, que son datos sensibles y están sujetos al régimen más estricto de la Ley Nº 21.719. Esta política rige la forma en que se recolectan, usan, resguardan y conservan, y los derechos de las personas titulares. La vigencia plena de la ley es el 1 de diciembre de 2026.`,
          `El responsable del tratamiento es ${legalOwner.companyName}, RUT ${legalOwner.rut}, domiciliado en ${legalOwner.address}.`,
          `Delegado de protección de datos: ${legalOwner.dpoName} (administración), quien coordina la aplicación de esta política y atiende las solicitudes de los titulares.`,
        ],
        title: "1. Objetivo y responsable",
      },
      {
        id: "datos-que-se-tratan",
        paragraphs: [
          "El establecimiento trata datos de identificación y contacto de los pacientes y datos relativos a su salud (anamnesis, antecedentes, resultados de pruebas de alergia y tratamientos). Estos últimos son datos sensibles.",
        ],
        title: "2. Datos que se tratan",
      },
      {
        id: "finalidad-base",
        paragraphs: [
          "La finalidad principal del tratamiento es la atención de salud de la persona: el diagnóstico, el tratamiento y el seguimiento alergológico, así como el cumplimiento de las obligaciones legales del prestador. El tratamiento con fines de atención de salud se ampara en la base de licitud sanitaria que la ley contempla para los datos de salud.",
          "Cualquier uso distinto del de la atención (por ejemplo, comunicaciones no asistenciales) requiere el consentimiento expreso del titular.",
        ],
        title: "3. Finalidad y base de licitud",
      },
      {
        id: "principios",
        paragraphs: [
          "El tratamiento se rige por los principios de licitud y lealtad, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia e información, y confidencialidad. Los datos se recolectan con fines específicos y no se tratan de manera incompatible con ellos.",
        ],
        title: "4. Principios",
      },
      {
        id: "derechos",
        bullets: [
          "Acceso: conocer qué datos suyos tratamos y obtener una copia.",
          "Rectificación: corregir datos inexactos o incompletos.",
          "Supresión: solicitar la eliminación de sus datos cuando proceda.",
          "Oposición: oponerse a un tratamiento determinado de sus datos.",
          "Portabilidad: recibir sus datos en un formato estructurado y de uso común.",
          "Bloqueo: suspender temporalmente el tratamiento de un dato.",
        ],
        paragraphs: [
          "Toda persona titular puede ejercer ante el establecimiento los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo de sus datos personales.",
        ],
        title: "5. Derechos de las personas titulares",
      },
      {
        id: "como-ejercerlos",
        paragraphs: [
          `La solicitud se presenta ante el delegado de protección de datos, por escrito o al correo ${legalOwner.privacyEmail}, identificando al titular y el derecho que ejerce. También puede usar el formulario en línea en la página de ejercicio de derechos.`,
          "El establecimiento responde dentro de treinta días corridos contados desde el ingreso de la solicitud, plazo que puede prorrogarse por una sola vez hasta por treinta días corridos adicionales. El ejercicio de los derechos de rectificación, supresión y oposición es siempre gratuito; el derecho de acceso es gratuito al menos una vez por trimestre. Si la solicitud es rechazada o no se responde, el titular puede reclamar ante la Agencia de Protección de Datos Personales dentro del plazo de treinta días hábiles.",
          "Límite por ficha clínica: la supresión no procede cuando la conservación del dato es necesaria para cumplir una obligación legal, como ocurre con la ficha clínica, que debe conservarse por quince años. En esos casos puede proceder el bloqueo en lugar de la supresión.",
        ],
        title: "6. Cómo ejercer sus derechos",
      },
      {
        id: "seguridad",
        paragraphs: [
          "El establecimiento aplica medidas de seguridad apropiadas para proteger los datos frente a su pérdida, filtración, daño accidental o destrucción: control de acceso por usuario y contraseña, perfiles diferenciados, registro de accesos, cifrado en reposo y en tránsito, respaldos periódicos y deber de confidencialidad del personal. Las medidas se documentan y se revisan periódicamente.",
        ],
        title: "7. Medidas de seguridad",
      },
      {
        id: "encargados",
        paragraphs: [
          "Cuando un tercero trata datos por cuenta del establecimiento (por ejemplo, el proveedor de alojamiento del sistema de fichas), actúa como encargado de tratamiento. La relación se regula por un contrato escrito (acuerdo de tratamiento de datos), conforme al artículo 15 bis de la Ley Nº 21.719. El encargado solo trata los datos según las instrucciones del establecimiento, no puede delegar el encargo sin autorización escrita y debe aplicar las mismas medidas de seguridad y de notificación de vulneraciones.",
          "Caso del alojamiento: el sistema de fichas se aloja en un proveedor de infraestructura tecnológica. El establecimiento suscribe con dicho proveedor el acuerdo de tratamiento de datos correspondiente y conserva la evidencia de sus certificaciones de seguridad.",
        ],
        title: "8. Encargados de tratamiento",
      },
      {
        id: "transferencia-internacional",
        paragraphs: [
          "Si el proveedor de alojamiento almacena los datos fuera de Chile, se configura una transferencia internacional de datos. Esta es lícita cuando el país de destino cuenta con una decisión de adecuación, o cuando entre el establecimiento y el receptor existen garantías adecuadas, por ejemplo cláusulas contractuales que las contengan (artículos 27 y 28 de la Ley Nº 21.719). El establecimiento verifica la región de almacenamiento del proveedor, prefiere una región con un marco de protección adecuado y documenta la base que habilita la transferencia.",
        ],
        title: "9. Transferencia internacional",
      },
      {
        id: "brechas",
        paragraphs: [
          "Ante una vulneración de las medidas de seguridad que afecte datos personales, el establecimiento la registra, evalúa su alcance, adopta medidas de contención y la notifica a la Agencia de Protección de Datos Personales. Por tratarse de datos sensibles de salud, la vulneración se comunica también a las personas titulares afectadas cuando corresponda.",
        ],
        title: "10. Vulneraciones de seguridad (brechas)",
      },
      {
        id: "conservacion",
        paragraphs: [
          "Los datos de la ficha clínica se conservan por el plazo legal de quince años desde la última prestación. Cumplido el fin del tratamiento o el plazo legal, los datos se suprimen o se anonimizan de forma segura. Esta política no duplica los plazos que ya rigen por la Ley Nº 20.584 y el Reglamento de Ficha Clínica, sino que se superpone como capa de protección de datos.",
        ],
        title: "11. Conservación",
      },
      {
        id: "plan-adecuacion",
        paragraphs: [
          "Antes del 1 de diciembre de 2026, el establecimiento publica esta política, implementa el procedimiento de ejercicio de derechos, documenta sus medidas de seguridad, define el protocolo de notificación de vulneraciones, suscribe los acuerdos de encargado con sus proveedores y revisa las instrucciones que dicte la Agencia de Protección de Datos Personales.",
          "Esta política rige desde su aprobación y se revisa al menos una vez al año, o antes si cambia la normativa o las instrucciones de la Agencia.",
        ],
        title: "12. Plan de adecuación y vigencia",
      },
    ],
    seoDescription:
      "Política de Protección de Datos Personales de Bioalergia conforme a la Ley Nº 21.719: tratamiento de datos sensibles de salud, derechos del titular, seguridad, encargados y conservación de la ficha clínica.",
    seoTitle: "Política de Protección de Datos | Bioalergia",
    summary:
      "Describe cómo Bioalergia trata los datos personales y los datos sensibles de salud de sus pacientes conforme a la Ley Nº 21.719, los derechos de las personas titulares y las medidas de seguridad aplicadas.",
    title: "Política de Protección de Datos Personales",
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
        paragraphs: [`Contacto principal para estas solicitudes: ${legalOwner.privacyEmail}.`],
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
