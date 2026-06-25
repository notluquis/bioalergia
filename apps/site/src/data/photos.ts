/**
 * Clinic photo manifest — authentic Bioalergia photoshoot (masters in OneDrive
 * `BIOALERGIA/FOTOGRAFIAS`, 16-bit TIFF). Optimised to responsive WebP in
 * `public/fotos/` (1600w + 800w, q80) via cwebp.
 *
 * The design system mandates REAL clinical photography (no stock, no
 * infographics). Every photo here is placed across the site (home + clinical
 * pages); see `<Photo>` (`components/ui/Photo.tsx`).
 *
 * ponytail: photos carry the "Bioalergia" watermark bottom-right — usable
 * (it's the clinic's own mark) but ask the client for clean masters to swap in.
 */

export type ClinicPhotoName =
  | "founderPortrait"
  | "doctorDesk"
  | "patchBack"
  | "patchWide"
  | "prickArm"
  | "prickDark"
  | "prickDrops"
  | "prickGrid"
  | "skinTest"
  | "extractsCase"
  | "scitSyringe"
  | "scitInjection";

export interface ClinicPhoto {
  /** file stem in /fotos (one per width) */
  stem: string;
  /** descriptive alt — Spanish, content-accurate */
  alt: string;
  /** object-position focal point for cover crops */
  position: string;
  orientation: "landscape" | "portrait";
}

export const clinicPhotos: Record<ClinicPhotoName, ClinicPhoto> = {
  founderPortrait: {
    stem: "founder-portrait",
    alt: "Dr. José Manuel Martínez en su consulta de alergología",
    position: "60% 22%",
    orientation: "portrait",
  },
  doctorDesk: {
    stem: "doctor-desk",
    alt: "Dr. José Manuel Martínez revisando antecedentes en consulta",
    position: "center",
    orientation: "landscape",
  },
  patchBack: {
    stem: "patch-back",
    alt: "Test de parche aplicado en la espalda de un paciente",
    position: "center",
    orientation: "portrait",
  },
  patchWide: {
    stem: "patch-wide",
    alt: "Especialista revisando un test de parche en la espalda",
    position: "center 30%",
    orientation: "landscape",
  },
  prickArm: {
    stem: "prick-arm",
    alt: "Prueba cutánea (prick test) en el antebrazo",
    position: "center",
    orientation: "landscape",
  },
  prickDark: {
    stem: "prick-dark",
    alt: "Aplicación de prueba cutánea con lanceta",
    position: "center",
    orientation: "landscape",
  },
  prickDrops: {
    stem: "prick-drops",
    alt: "Aplicación de extractos alergénicos sobre el antebrazo",
    position: "center",
    orientation: "landscape",
  },
  prickGrid: {
    stem: "prick-grid",
    alt: "Marcado de la grilla de prueba cutánea en el antebrazo",
    position: "center 35%",
    orientation: "portrait",
  },
  skinTest: {
    stem: "skin-test",
    alt: "Profesional de Bioalergia realizando una prueba cutánea",
    position: "center 25%",
    orientation: "portrait",
  },
  extractsCase: {
    stem: "extracts-case",
    alt: "Maletín de extractos alergénicos estandarizados",
    position: "center",
    orientation: "landscape",
  },
  scitSyringe: {
    stem: "scit-syringe",
    alt: "Preparación de una dosis de inmunoterapia subcutánea",
    position: "center",
    orientation: "landscape",
  },
  scitInjection: {
    stem: "scit-injection",
    alt: "Administración de inmunoterapia subcutánea en el brazo",
    position: "center",
    orientation: "landscape",
  },
};

export function photoSrcSet(stem: string): { src: string; srcSet: string } {
  return {
    src: `/fotos/${stem}-1600.webp`,
    srcSet: `/fotos/${stem}-800.webp 800w, /fotos/${stem}-1600.webp 1600w`,
  };
}
