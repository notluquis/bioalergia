/**
 * Design system constants for className strings.
 * Centralized to ensure consistency and easier refactoring.
 */

// ===== LAYOUT CONTAINERS =====

/** Main page container: centered, max-width, vertical spacing */
export const PAGE_CONTAINER = "w-full space-y-4";

/** Looser spacing variant (for pages with larger sections) */
export const PAGE_CONTAINER_RELAXED = "mx-auto max-w-7xl space-y-6";

// ===== TYPOGRAPHY =====

/** Large page title (3xl) */
export const TITLE_XL = "text-3xl font-bold text-foreground";

/** Standard page title (2xl) */
export const TITLE_LG = "text-2xl font-bold text-primary";

/** Section title (xl) */
export const TITLE_MD = "text-xl font-bold text-primary";

/** Small title / heading (lg) */
export const TITLE_SM = "text-lg font-semibold text-primary";

// ===== SPACING =====

/** Tight vertical spacing for related elements */
export const SPACE_Y_TIGHT = "space-y-2";

/** Standard vertical spacing */
export const SPACE_Y = "space-y-4";

/** Relaxed vertical spacing for major sections */
export const SPACE_Y_RELAXED = "space-y-6";

// ===== LAYOUT UTILITIES =====

/** Flex container with centered items and gap */
export const FLEX_CENTER_GAP_2 = "flex items-center gap-2";

/** Flex container with centered items and small gap */
export const FLEX_CENTER_GAP_1 = "flex items-center gap-1";

/** Flex container with centered items and larger gap */
export const FLEX_CENTER_GAP_3 = "flex items-center gap-3";

// ===== LOADING SPINNERS =====
// @deprecated: Use <Spinner /> from @heroui/react instead

// ===== GRID LAYOUTS =====

/** 2-column grid for forms (responsive, 2 cols on small+) */
export const GRID_2_COL_SM = "grid gap-3 sm:grid-cols-2";

/** 2-column grid for forms (responsive, 2 cols on medium+) */
export const GRID_2_COL_MD = "grid gap-4 md:grid-cols-2";

/** 3-column grid for cards */
export const GRID_3_COL = "grid gap-4 md:grid-cols-2 lg:grid-cols-3";
