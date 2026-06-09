/**
 * Canonical query keys for the authenticated user's own data.
 *
 * `userProfileKey` is the single source of truth for the self-service
 * profile cache, shared by `ProfilePanel` (`/account?tab=perfil`) and the
 * onboarding wizard (`useOnboardingForm`). Both fetch `fetchUserProfile`
 * and must invalidate the same cache entry — keep them on this key to
 * avoid drift.
 */
export const userProfileKey = ["user", "profile"] as const;
