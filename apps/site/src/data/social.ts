// Enlaces a redes sociales de Bioalergia. Custom (sin widgets de terceros):
// más rápido, sin cookies de tracking (Ley 21.719) y sin penalizar Lighthouse.
// Se renderizan en el footer solo los que tengan `href` completo.

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok";

export type SocialLink = {
  platform: SocialPlatform;
  label: string;
  href: string;
};

export const socialLinks: SocialLink[] = [
  { platform: "instagram", label: "Instagram", href: "https://www.instagram.com/bioalergia" },
  { platform: "facebook", label: "Facebook", href: "https://www.facebook.com/bioalergia" },
  { platform: "tiktok", label: "TikTok", href: "https://www.tiktok.com/@bioalergia" },
];
