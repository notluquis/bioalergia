import { founderProfile } from "./founder";

export type TeamMember = {
  name: string;
  role: string;
  /** Short chip label shown next to the name. */
  badge: string;
  paragraphs: string[];
  email?: string;
  linkedin?: string;
};

export const team: TeamMember[] = [
  {
    name: founderProfile.name,
    role: "Director médico · Alergólogo e inmunólogo",
    badge: "Director médico",
    paragraphs: founderProfile.paragraphs,
    // Sin correo público por decisión del equipo.
  },
  {
    name: "Lucas Pulgar Escobar",
    role: "Coordinador financiero · Desarrollador full stack y científico de datos",
    badge: "Coordinación",
    paragraphs: [
      "Lucas Pulgar Escobar es el coordinador financiero de Bioalergia y, además, desarrollador full stack y científico de datos. Tiene un magíster en Astronomía, formación con la que se especializó en analizar grandes volúmenes de datos y resolver problemas complejos; hoy aplica ese mismo enfoque a la gestión y la tecnología de la clínica.",
      "Lidera la gestión financiera y administrativa de Bioalergia —cobranza, facturación y control de gestión— y desarrolla sus plataformas digitales: el sitio web, la intranet clínica y los sistemas internos que apoyan la atención, ordenan la información y mejoran de forma continua la experiencia de pacientes y equipo.",
    ],
    email: "lpulgar@bioalergia.cl",
    linkedin: "https://www.linkedin.com/in/lucasescobarpulgar/",
  },
];
