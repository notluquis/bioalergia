// Enlaces a redes sociales de Bioalergia. Custom (sin widgets de terceros):
// más rápido, sin cookies de tracking (Ley 21.719) y sin penalizar Lighthouse.
// Se renderizan en el footer solo los que tengan `href` completo.

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok";

export type SocialLink = {
  platform: SocialPlatform;
  label: string;
  href: string;
};

// TODO(user): completar con las URLs reales de las cuentas de Bioalergia.
// Ejemplos:
//   { platform: "instagram", label: "Instagram", href: "https://www.instagram.com/<cuenta>" },
//   { platform: "facebook",  label: "Facebook",  href: "https://www.facebook.com/<cuenta>" },
export const socialLinks: SocialLink[] = [];
