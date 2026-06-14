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
    role: "Coordinador financiero · Full Stack Developer",
    badge: "Coordinación",
    paragraphs: [
      "Lucas Pulgar Escobar es el coordinador financiero de Bioalergia y desarrollador full stack de la clínica. Lidera la gestión financiera y administrativa, asegurando que los procesos de cobranza, facturación y control de gestión funcionen de forma ordenada y transparente.",
      "Como desarrollador, está a cargo de las plataformas digitales de Bioalergia: el sitio web, la intranet clínica y los sistemas internos que apoyan la atención, la trazabilidad de la información y la mejora continua de la experiencia de pacientes y equipo.",
    ],
    email: "lpulgar@bioalergia.cl",
    // TODO(user): completar URL de LinkedIn de Lucas.
    linkedin: "",
  },
];
