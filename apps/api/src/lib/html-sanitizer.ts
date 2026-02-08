import { clearWindow, sanitize } from "isomorphic-dompurify";
import type { LinkValidationConfig } from "./sanitizer-hooks";
import { clearAllHooks, registerLinkValidationHook } from "./sanitizer-hooks";
import { getGlobalMonitor } from "./sanitizer-metrics";

/**
 * DOMPurify Configuration Presets
 *
 * v3.0.0+: isomorphic-dompurify is ESM-native with clearWindow() for memory leak prevention
 * in long-running Node.js processes.
 */

/**
 * MINIMAL_CONFIG: Bare essentials for user comments
 *
 * Use case: Forum comments, chat messages, simple user-generated text
 * Threat model: XSS injection via HTML
 *
 * Allowed: Basic text formatting (bold, italic, emphasis)
 * Blocked: Links, images, tables, styles (use hyperlinks separately)
 */
export const MINIMAL_CONFIG = {
  ALLOWED_TAGS: [
    // Text formatting only
    "b",
    "i",
    "em",
    "strong",
    "u",
    "p",
    "br",
  ],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

/**
 * MODERATE_CONFIG: Standard for user content with links
 *
 * Use case: Calendar event descriptions, user bios, simple notes
 * Threat model: XSS + link hijacking
 *
 * Allowed: Text formatting + links (with whitelist validation)
 * Blocked: Images, tables, styles
 * Note: Use with registerLinkValidationHook() for domain whitelisting
 */
export const MODERATE_CONFIG = {
  ALLOWED_TAGS: [
    // Text formatting
    "b",
    "i",
    "em",
    "strong",
    "u",
    "p",
    "br",
    // Links (validate with hook)
    "a",
    // Structure
    "div",
  ],
  ALLOWED_ATTR: [
    // Links only (href is validated by hook)
    "href",
    "title",
  ],
  KEEP_CONTENT: true,
};

/**
 * RICH_CONFIG: Full-featured for email templates and admin content
 *
 * Use case: Email campaigns, newsletters, admin rich-text editing
 * Threat model: XSS + CSS injection + external resource loading
 *
 * Allowed: All safe tags (text, structure, tables, images, styles)
 * Blocked: Script tags, form elements, event handlers
 * Note: Use with sanitizeHtmlWithOptions() for rate limiting + audit logging
 */
export const RICH_CONFIG = {
  ALLOWED_TAGS: [
    // Text formatting
    "b",
    "i",
    "em",
    "strong",
    "u",
    "small",
    "br",
    "p",
    "span",
    // Structure
    "div",
    "section",
    "article",
    // Lists
    "ul",
    "ol",
    "li",
    // Tables (for email layouts)
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    // Links (with href validation)
    "a",
    // Headings
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    // Images
    "img",
  ],
  ALLOWED_ATTR: [
    // Links
    "href",
    "target",
    "rel",
    // Images
    "src",
    "alt",
    "width",
    "height",
    // Tables
    "colspan",
    "rowspan",
    "border",
    "cellpadding",
    "cellspacing",
    // General
    "class",
    "id",
    "style",
  ],
  // Allow data: URLs for images (common in email templates)
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
};

/**
 * Default configuration (backward compatibility)
 * Maps to RICH_CONFIG for server-side HTML handling
 *
 * Exported for reference, but prefer using sanitizeHtml(html, "rich") instead
 */
export const SANITIZE_CONFIG = RICH_CONFIG;

export interface SanitizeOptions {
  /**
   * Track metrics (rate limiting, audit log) for this operation
   * Default: true
   */
  trackMetrics?: boolean;

  /**
   * User ID for audit logging
   */
  userId?: string;

  /**
   * Operation context (for audit logging)
   */
  context?: string;

  /**
   * Configuration preset to use
   * Default: 'rich' (RICH_CONFIG)
   */
  configType?: "minimal" | "moderate" | "rich";

  /**
   * Link validation config (enables custom link validation hook)
   */
  validateLinks?: LinkValidationConfig;
}

/**
 * Advanced sanitize with metrics, rate limiting, and hooks
 *
 * @example
 * ```ts
 * const sanitized = sanitizeHtmlWithOptions(userContent, {
 *   trackMetrics: true,
 *   userId: 'user-123',
 *   context: 'calendar-description',
 *   validateLinks: {
 *     whitelistedDomains: ['bioalergia.cl'],
 *     allowAnchors: true,
 *     allowRelative: true,
 *   }
 * });
 * ```
 */
export function sanitizeHtmlWithOptions(html: string, options: SanitizeOptions = {}): string {
  const startTime = Date.now();
  const { trackMetrics = true, userId, configType = "rich", validateLinks } = options;

  // Select config based on configType
  const config = {
    minimal: MINIMAL_CONFIG,
    moderate: MODERATE_CONFIG,
    rich: RICH_CONFIG,
  }[configType];

  try {
    // Check rate limiting before sanitization
    if (trackMetrics) {
      const monitor = getGlobalMonitor();
      const check = monitor.checkAndLog("sanitize", html.length, 0, 0, userId);
      if (!check.allowed) {
        console.warn("Sanitization rate limit exceeded:", check.reason);
        return "";
      }
    }

    // Register custom hooks if needed
    if (validateLinks) {
      registerLinkValidationHook(validateLinks);
    }

    // Sanitize
    const result = sanitize(html, config);

    // Record metrics
    if (trackMetrics) {
      const duration = Date.now() - startTime;
      const monitor = getGlobalMonitor();
      monitor.checkAndLog("sanitize", html.length, result.length, duration, userId);
    }

    return result;
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return "";
  }
}

/**
 * Sanitize HTML content with DOMPurify
 *
 * @param html - HTML string to sanitize
 * @param configType - Configuration preset ('minimal', 'moderate', 'rich'). Default: 'rich'
 *
 * @example
 * ```ts
 * // Use default (RICH_CONFIG)
 * const clean = sanitizeHtml('<p onclick="alert(\'xss\')">Hello</p>');
 * // Result: '<p>Hello</p>'
 *
 * // Use minimal config for comments
 * const minimal = sanitizeHtml('<p>Comment <img src=x>', 'minimal');
 * // Result: '<p>Comment </p>' (img removed)
 *
 * // Use moderate config for calendar events
 * const moderate = sanitizeHtml('<p>Event <a href="...">Link</a></p>', 'moderate');
 * // Result: '<p>Event <a href="...">Link</a></p>'
 * ```
 */
export function sanitizeHtml(
  html: string,
  configType: "minimal" | "moderate" | "rich" = "rich",
): string {
  const config = {
    minimal: MINIMAL_CONFIG,
    moderate: MODERATE_CONFIG,
    rich: RICH_CONFIG,
  }[configType];

  try {
    return sanitize(html, config);
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return ""; // Return empty string on error
  }
}

/**
 * Clear jsdom window state to prevent memory leaks in long-running servers
 *
 * Call this:
 * - Periodically (e.g., after processing N requests)
 * - After handling batches of content
 * - In response completion handlers
 *
 * Note: Any DOMPurify hooks or config will need to be re-applied
 *
 * @example
 * ```ts
 * // In middleware
 * app.use((c, next) => {
 *   return next().finally(() => {
 *     // Clear window every request to prevent memory buildup
 *     clearWindowState();
 *   });
 * });
 * ```
 */
export function clearWindowState(): void {
  try {
    clearAllHooks();
    clearWindow();
  } catch {
    // clearWindow() is a no-op in browser environments
    // Safe to call anywhere
  }
}

/**
 * Middleware factory for Hono to clear jsdom state after each response
 * Prevents unbounded memory growth in long-running Node.js processes
 *
 * Usage in app.ts:
 * ```ts
 * import { htmlSanitizerMiddleware } from './lib/html-sanitizer';
 * app.use('*', htmlSanitizerMiddleware());
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: Hono middleware typing
export function htmlSanitizerMiddleware(): (c: any, next: any) => Promise<void> {
  return async (_c, next) => {
    try {
      await next();
    } finally {
      // Clear jsdom window after response to prevent memory leaks
      clearWindowState();
    }
  };
}

/**
 * ============================================================================
 * ADVANCED v3 FEATURES (Available for future implementations)
 * ============================================================================
 *
 * isomorphic-dompurify v3.0.0+ provides several advanced capabilities:
 *
 * 1. addHook() - Register custom hooks for sanitization pipeline
 *    Use case: Validate links against internal domain whitelist
 *    ```ts
 *    import { addHook } from 'isomorphic-dompurify';
 *    addHook('afterSanitizeAttributes', (node) => {
 *      if (node.tagName === 'A') {
 *        const href = node.getAttribute('href');
 *        if (!href?.startsWith(process.env.DOMAIN_WHITELIST)) {
 *          node.removeAttribute('href');
 *        }
 *      }
 *    });
 *    ```
 *
 * 2. setConfig() - Global DOMPurify configuration
 *    Use case: Re-apply custom config after clearWindow()
 *    ```ts
 *    import { setConfig } from 'isomorphic-dompurify';
 *    setConfig({ ALLOWED_TAGS: [...custom tags] });
 *    ```
 *
 * 3. FORCE_BODY: true - Recommended for server-side sanitization
 *    Use case: Ensure consistent HTML structure
 *    ```ts
 *    sanitize(html, { ...SANITIZE_CONFIG, FORCE_BODY: true })
 *    ```
 *
 * Memory Leak Prevention Deep Dive:
 * - Old behavior (v2): jsdom window accumulated state → unbounded memory
 * - New behavior (v3): clearWindow() resets jsdom state → predictable memory usage
 * - Benefit: Long-running servers stay stable even with 1000s of sanitizations
 * - Cost: Minimal (jsdom reinit is fast)
 *
 * References:
 * - https://github.com/isomorphic-git/isomorphic-dompurify/releases/tag/v3.0.0-rc.2
 * - https://github.com/cure53/DOMPurify#readme
 */
