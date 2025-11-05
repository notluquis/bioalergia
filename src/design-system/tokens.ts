/**
 * Design System Tokens - Bioalergia Finanzas
 * Apple-grade spacing, typography, and component standards
 *
 * RULES:
 * 1. Use ONLY these tokens - no arbitrary values
 * 2. Spacing follows 4px base grid (xs through 6xl)
 * 3. Typography has defined line-heights for readability
 * 4. All touch targets minimum 44×44px (iOS HIG)
 */

// ============================================================================
// SPACING SCALE (4px base grid)
// ============================================================================
export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
  "4xl": "6rem", // 96px
  "5xl": "8rem", // 128px
  "6xl": "12rem", // 192px
} as const;

// Tailwind class mappings for convenience
export const spacingClasses = {
  xs: "1", // p-1, gap-1, space-y-1
  sm: "2", // p-2, gap-2, space-y-2
  md: "4", // p-4, gap-4, space-y-4
  lg: "6", // p-6, gap-6, space-y-6
  xl: "8", // p-8, gap-8, space-y-8
  "2xl": "12", // p-12, gap-12, space-y-12
  "3xl": "16", // p-16, gap-16, space-y-16
  "4xl": "24", // p-24, gap-24, space-y-24
  "5xl": "32", // p-32, gap-32, space-y-32
  "6xl": "48", // p-48, gap-48, space-y-48
} as const;

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================
export const typography = {
  xs: { size: "0.75rem", lineHeight: "1rem" }, // 12px / 16px
  sm: { size: "0.875rem", lineHeight: "1.25rem" }, // 14px / 20px
  base: { size: "1rem", lineHeight: "1.5rem" }, // 16px / 24px
  lg: { size: "1.125rem", lineHeight: "1.75rem" }, // 18px / 28px
  xl: { size: "1.25rem", lineHeight: "1.75rem" }, // 20px / 28px
  "2xl": { size: "1.5rem", lineHeight: "2rem" }, // 24px / 32px
  "3xl": { size: "1.875rem", lineHeight: "2.25rem" }, // 30px / 36px
  "4xl": { size: "2.25rem", lineHeight: "2.5rem" }, // 36px / 40px
} as const;

// ============================================================================
// COMPONENT DIMENSIONS
// ============================================================================
export const component = {
  // Button heights (with touch target compliance)
  buttonHeight: {
    xs: "2rem", // 32px
    sm: "2.5rem", // 40px
    md: "2.75rem", // 44px ✓ iOS HIG compliant
    lg: "3rem", // 48px
  },

  // Input heights
  inputHeight: {
    sm: "2.5rem", // 40px
    md: "2.75rem", // 44px ✓ iOS HIG compliant
    lg: "3rem", // 48px
  },

  // Card padding variants
  cardPadding: {
    compact: spacingClasses.md, // p-4 (16px)
    default: spacingClasses.lg, // p-6 (24px)
    spacious: spacingClasses.xl, // p-8 (32px)
  },

  // Border radius
  radius: {
    sm: "0.375rem", // 6px
    md: "0.5rem", // 8px
    lg: "0.75rem", // 12px
    xl: "1rem", // 16px
    "2xl": "1.25rem", // 20px
    full: "9999px",
  },

  // Shadow depths (based on DaisyUI)
  shadow: {
    sm: "shadow-sm",
    md: "shadow",
    lg: "shadow-lg",
    xl: "shadow-xl",
  },
} as const;

// ============================================================================
// BREAKPOINTS (match Tailwind defaults)
// ============================================================================
export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ============================================================================
// Z-INDEX SCALE (prevent z-index chaos)
// ============================================================================
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  toast: 60,
} as const;

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================
export const layout = {
  // Page container max-widths
  containerMaxWidth: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
    full: "100%",
  },

  // Sidebar widths
  sidebarWidth: {
    collapsed: "4rem", // 64px (icon-only)
    default: "16rem", // 256px
    wide: "20rem", // 320px
  },

  // iOS bottom tab bar height
  bottomTabHeight: "3.5rem", // 56px (safe for home indicator)

  // Header heights
  headerHeight: {
    mobile: "3.5rem", // 56px
    desktop: "4rem", // 64px
  },
} as const;

// ============================================================================
// ANIMATION DURATIONS (Apple-like timing)
// ============================================================================
export const animation = {
  fast: "150ms",
  normal: "250ms",
  slow: "350ms",
  slower: "500ms",
} as const;

// ============================================================================
// USAGE EXAMPLES
// ============================================================================
/*
// ✅ CORRECT - Using tokens
<div className="p-6 gap-4 rounded-xl">
  <Button size="md" /> // 44px height - touch compliant
  <Input className="h-11" /> // 44px height
</div>

// ❌ WRONG - Arbitrary values
<div className="p-7 gap-5 rounded-[13px]">
  <button className="h-[38px]" /> // Too small for touch
</div>

// ✅ CORRECT - Typography with line-height
<h1 className="text-2xl leading-8">Title</h1>
<p className="text-base leading-6">Body text</p>

// ❌ WRONG - Missing line-height
<h1 className="text-2xl">Title</h1>
*/
