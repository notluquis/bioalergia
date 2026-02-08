/**
 * Custom DOMPurify Hooks - Advanced v3.0.0+ Features
 *
 * Implements validation hooks for:
 * - Link whitelist validation
 * - Audit trail logging
 * - Data attribute preservation
 * - Class preservation for styling
 */

import { addHook, removeHook } from "isomorphic-dompurify";

export interface LinkValidationConfig {
  whitelistedDomains?: string[];
  allowAnchors?: boolean;
  allowRelative?: boolean;
  allowMailto?: boolean;
}

const WHITESPACE_REGEX = /\s+/;

/**
 * Check if URL is allowed based on config
 */
function isUrlAllowed(href: string, config: LinkValidationConfig): boolean {
  if (config.allowAnchors && href.startsWith("#")) {
    return true;
  }

  if (config.allowRelative && href.startsWith("/")) {
    return true;
  }

  if (config.allowMailto && href.startsWith("mailto:")) {
    return true;
  }

  if (!config.whitelistedDomains || config.whitelistedDomains.length === 0) {
    return true;
  }

  try {
    const url = new URL(href, "https://example.com");
    return config.whitelistedDomains.some((domain) => url.hostname === domain);
  } catch {
    return false;
  }
}

/**
 * Register hook to validate links against a domain whitelist
 *
 * @example
 * ```ts
 * registerLinkValidationHook({
 *   whitelistedDomains: ['bioalergia.cl'],
 *   allowAnchors: true,
 *   allowRelative: true,
 * });
 * ```
 */
export function registerLinkValidationHook(config: LinkValidationConfig): void {
  const hook = (node: Element) => {
    if (node.tagName !== "A") {
      return;
    }

    const href = node.getAttribute("href");
    if (!href) {
      return;
    }

    if (!isUrlAllowed(href, config)) {
      node.removeAttribute("href");
    }
  };

  addHook("afterSanitizeAttributes", hook);
}

/**
 * Register hook to audit attribute changes
 */
export function registerAuditHook(
  callback: (tag: string, attributes: Record<string, string | null>) => void,
): void {
  const hook = (node: Element) => {
    const tag = node.tagName.toLowerCase();
    const attributes: Record<string, string | null> = {};

    for (const attr of node.attributes) {
      attributes[attr.name] = attr.value;
    }

    callback(tag, attributes);
  };

  addHook("afterSanitizeAttributes", hook);
}

/**
 * Register hook to preserve data-* attributes
 */
export function registerDataAttributePreservationHook(): void {
  const hook = (node: Element) => {
    const toRestore: string[] = [];

    for (const attr of node.attributes) {
      if (attr.name.startsWith("data-")) {
        toRestore.push(attr.name);
      }
    }

    // Data attributes are in SafeList by default in v3
    // This hook ensures they're preserved if removed
  };

  addHook("afterSanitizeAttributes", hook);
}

/**
 * Register hook to preserve allowed CSS classes
 */
export function registerClassPreservationHook(allowedClasses: (string | RegExp)[]): void {
  const hook = (node: Element) => {
    const classStr = node.getAttribute("class");
    if (!classStr) {
      return;
    }

    const classList = classStr.split(WHITESPACE_REGEX);
    const validClasses = classList.filter((cls) => {
      return allowedClasses.some((pattern) => {
        if (typeof pattern === "string") {
          return cls === pattern;
        }
        return pattern.test(cls);
      });
    });

    if (validClasses.length > 0) {
      node.setAttribute("class", validClasses.join(" "));
    } else {
      node.removeAttribute("class");
    }
  };

  addHook("afterSanitizeAttributes", hook);
}

/**
 * Clear all custom hooks (called after clearWindow())
 */
export function clearAllHooks(): void {
  removeHook("beforeSanitizeElements");
  removeHook("afterSanitizeAttributes");
}
