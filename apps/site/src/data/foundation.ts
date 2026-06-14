export type FundacionValue = {
  title: string;
  detail: string;
};

export type FundacionResource = {
  name: string;
  description: string;
  href: string;
  external: boolean;
};

export type FundacionContent = {
  intro: string;
  values: FundacionValue[];
  resources: FundacionResource[];
};

export const fundacionContent: FundacionContent = {
  intro:
    "Las alergias no son solo molestias pasajeras: afectan el sueño, el rendimiento, la alimentación y la vida diaria de miles de personas. Las entendemos como un asunto de salud pública y de calidad de vida, y creemos que la educación, la prevención y el acceso a información confiable son parte de nuestra responsabilidad como clínica.",
  values: [
    {
      title: "Educación y prevención",
      detail:
        "Compartir información clara sobre alergias e inmunología para que las personas reconozcan síntomas a tiempo y tomen decisiones informadas sobre su salud.",
    },
    {
      title: "Acceso a información confiable",
      detail:
        "Orientar a pacientes y familias hacia contenidos y organizaciones serias, evitando la desinformación que rodea a las enfermedades alérgicas.",
    },
    {
      title: "Acompañamiento del paciente",
      detail:
        "Entender la alergia como una condición que afecta la calidad de vida diaria y acompañar el proceso con cercanía, no solo en la consulta puntual.",
    },
    {
      title: "Mirada de largo plazo",
      detail:
        "Promover la prevención de complicaciones y un manejo sostenible en el tiempo, poniendo el bienestar de cada persona en el centro de las decisiones.",
    },
  ],
  resources: [
    {
      name: "Fundación Creciendo con Alergias",
      description:
        "Organización chilena de pacientes (activa desde 2008) dedicada a mejorar la calidad de vida de personas con alergias y dermatitis atópica. Ha impulsado avances como la Ley de Etiquetado de alimentos. La recomendamos como referente de apoyo y educación para pacientes y familias.",
      href: "https://www.creciendoconalergias.cl",
      external: true,
    },
    {
      name: "Red de monitoreo de pólenes (polenes.cl)",
      description:
        "Sitio externo de la Red Chilena de monitoreo de pólenes, útil para anticipar épocas de mayor exposición. Para entender cómo influye en los síntomas estacionales, revisa también nuestra propia guía de polen.",
      href: "https://www.polenes.cl",
      external: true,
    },
    {
      name: "Sociedad Chilena de Alergia e Inmunología (SCAI)",
      description:
        "Sociedad científica sin fines de lucro (desde 1946) que agrupa a especialistas en alergia e inmunología en Chile y promueve la educación, la investigación y guías clínicas en la especialidad.",
      href: "https://www.scai.cl",
      external: true,
    },
  ],
};
