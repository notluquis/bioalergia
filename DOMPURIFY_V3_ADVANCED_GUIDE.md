# DOMPurify v3 Advanced Implementation Guide

**Created:** February 7, 2026 | **Version:** v3.0.0-rc.2 | **Status:** Production Ready

---

## Table of Contents

1. [Phase 2: Advanced Features](#phase-2-advanced-features)
2. [Phase 3: Integration Patterns](#phase-3-integration-patterns)
3. [Phase 4: Security & Operations](#phase-4-security--operations)
4. [Troubleshooting & Debugging](#troubleshooting--debugging)

---

## Phase 2: Advanced Features

Implemented in `/apps/api/src/lib/`:

### 2.1 Custom Hooks for Link Validation

**File:** `sanitizer-hooks.ts`

**Use Case:** Ensure links only point to internal domains or whitelisted external sites.

```typescript
import { registerLinkValidationHook } from "./lib/sanitizer-hooks";

// Configuration
const linkConfig = {
  whitelistedDomains: ['bioalergia.cl', 'api.bioalergia.cl'],
  allowAnchors: true,          // Allow #section links
  allowRelative: true,          // Allow /path links
  allowMailto: true,            // Allow mailto: links
};

// Register once at server startup
registerLinkValidationHook(linkConfig);
```

**How It Works:**
- Runs `afterSanitizeAttributes` hook
- Checks each `<a href="...">` against whitelist
- Removes `href` attribute if not whitelisted (non-clickable link)
- Preserves anchor, relative, and mailto links

**Security Impact:**
- ✅ Prevents XSS via javascript: URLs
- ✅ Prevents external link injection
- ✅ Allows internal cross-linking
- ✅ Allows contact links (mailto)

### 2.2 Rate Limiting for Sanitization

**File:** `sanitizer-metrics.ts` → `SanitizationRateLimiter`

**Use Case:** Prevent DoS attacks targeting the sanitization endpoint.

```typescript
import { SanitizationMonitor } from "./lib/sanitizer-metrics";

const monitor = new SanitizationMonitor();

// In request handler:
app.post("/api/sanitize", async (c) => {
  const html = c.req.json().html;
  const userId = c.get('user')?.id;

  // This checks rate limiting automatically
  const { allowed, reason } = monitor.checkAndLog(
    "sanitize",
    html.length,
    0, // output length (set after sanitization)
    0  // duration (set after sanitization)
  );

  if (!allowed) {
    return c.json(
      { error: reason || "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Proceed with sanitization...
});
```

**Configuration:**
- Window: 60 seconds (default)
- Max operations: 1000 per window
- Customizable: `new SanitizationRateLimiter(120000, 500)`

### 2.3 Audit Logging

**File:** `sanitizer-metrics.ts` → `SanitizationAuditLog`

**Use Case:** Compliance, debugging, and security audits.

```typescript
import { getGlobalMonitor } from "./lib/sanitizer-metrics";

const monitor = getGlobalMonitor();

// After sanitization:
monitor.checkAndLog(
  "sanitize",
  inputHtml.length,   // 1500 bytes
  sanitizedHtml.length, // 1200 bytes (100 removed)
  25,                 // took 25ms
  userId              // user-abc-123
);

// Get audit trail (last hour):
const lastHour = monitor.getAuditEntries(1);
console.log("Sanitizations this hour:", lastHour.length);

// Get statistics:
const summary = getGlobalMonitor().getMetrics();
console.log(`Avg sanitization: ${summary.averageTimeMs}ms`);
console.log(`Memory delta: ${summary.memoryUsageMb}MB`);
```

**Audit Entry Fields:**
```typescript
{
  timestamp: Date,
  operation: "sanitize" | "clear" | "hook_register",
  inputLength: number,      // bytes before
  outputLength: number,     // bytes after
  durationMs: number,       // milliseconds
  userId?: string,          // who triggered it
  context?: string          // operation context
}
```

### 2.4 Memory Tracking

**File:** `sanitizer-metrics.ts` → `SanitizationMemoryMetrics`

**Use Case:** Monitor server memory health in production.

```typescript
import { getGlobalMonitor } from "./lib/sanitizer-metrics";

// Get metrics endpoint (for monitoring dashboards):
app.get("/api/internal/sanitizer-metrics", (c) => {
  const metrics = getGlobalMonitor().getMetrics();
  return c.json(metrics);
  // Response:
  // {
  //   totalOperations: 15243,
  //   operationsLastHour: 342,
  //   averageTimeMs: 18,
  //   lastOperationAt: "2026-02-07T23:45:12.000Z",
  //   memoryUsageMb: 42
  // }
});

// Alert if memory grows unexpectedly:
setInterval(() => {
  const metrics = getGlobalMonitor().getMetrics();
  if (metrics.memoryUsageMb > 200) {
    logger.warn(`High sanitizer memory: ${metrics.memoryUsageMb}MB`);
  }
}, 60000); // Check every minute
```

---

## Phase 3: Integration Patterns

### 3.1 User-Generated Content Flows

**Use Case:** Calendar event descriptions, comments, notes.

**Location:** `/apps/api/src/routes/calendar.ts`

```typescript
import { sanitizeHtmlWithOptions } from "../lib/html-sanitizer";
import { registerLinkValidationHook } from "../lib/sanitizer-hooks";

// In route handler:
app.post("/api/calendar/events", async (c) => {
  const { eventId, description } = await c.req.json();
  const userId = c.get('user').id;

  // Sanitize user-provided HTML
  const cleanDescription = sanitizeHtmlWithOptions(description, {
    trackMetrics: true,
    userId,
    context: "calendar-description",
    validateLinks: {
      whitelistedDomains: ['bioalergia.cl'],
      allowAnchors: true,
      allowRelative: true,
      allowMailto: true,
    }
  });

  // Save sanitized version
  await db.calendarEvent.update(eventId, {
    description: cleanDescription
  });

  return c.json({ success: true, cleanLength: cleanDescription.length });
});
```

**Security Checklist:**
- ✅ Store sanitized version in DB
- ✅ Never use `dangerouslySetInnerHTML` on display without re-sanitization
- ✅ Log operations for audit
- ✅ Validate file sizes (prevent massive inputs)

### 3.2 Email Sanitization for External Sources

**Use Case:** Email templates, notification HTML, imported content.

**Location:** `/apps/api/src/services/email.ts`

```typescript
import { sanitizeHtmlWithOptions } from "../lib/html-sanitizer";
import { registerClassPreservationHook } from "../lib/sanitizer-hooks";

// Register email-safe CSS classes
registerClassPreservationHook([
  // Tailwind email utilities
  'text-center', 'font-bold', 'bg-white', 'border',
  /^(p|m)[tbrl]-\d+/, // padding/margin utilities
  /^text-\w+/,         // text colors
]);

// Sanitize external HTML sources:
async function sanitizeExternalEmail(externalHtml: string) {
  return sanitizeHtmlWithOptions(externalHtml, {
    trackMetrics: true,
    context: "external-email",
    validateLinks: {
      allowMailto: true,
      allowAnchors: true,
      // Note: Don't whitelist external domains for security!
    }
  });
}

// Usage:
const templateHtml = await fetchTemplateFromCMS();
const safeHtml = await sanitizeExternalEmail(templateHtml);
const emailBody = await renderEmailWith(safeHtml);
```

**Email-Specific Considerations:**
- ✅ Preserve `<table>` structures (email clients use tables for layout)
- ✅ Preserve `style` attributes (needed for email styling)
- ✅ Allow `data-*` attributes (might be used by email templates)
- ⚠️ Be careful with external images (use proper Content-Security-Policy)
- ⚠️ Test with multiple email clients (Outlook, Gmail, etc.)

### 3.3 Notification HTML Escaping

**Use Case:** In-app notifications, toast messages, alerts.

**Location:** `/apps/api/src/routes/notifications.ts`

```typescript
import { sanitizeHtml } from "../lib/html-sanitizer";

app.post("/api/notifications", async (c) => {
  const { userId, message, actions } = await c.req.json();

  // For notifications, use simple sanitizeHtml (no advanced features needed)
  const safeMes = sanitizeHtml(message);

  // Sanitize action links too
  const safeActions = actions.map((action) => ({
    ...action,
    href: action.href.startsWith('/') ? action.href : null, // only internal
  }));

  await db.notification.create({
    userId,
    title: safeMes,    // sanitized
    actions: safeActions
  });

  return c.json({ created: true });
});
```

**Notification Best Practices:**
- ✅ Limit allowed tags to minimal set (no scripts, no external content)
- ✅ Use sanitizeHtml() (simpler than advanced options)
- ✅ Validate action URLs (strip suspicious schemes)
- ✅ Display in browser: React/framework will escape by default
- ✅ Optional: use `.textContent` instead of `.innerHTML` if no HTML needed

---

## Phase 4: Security & Operations

### 4.1 Runbook: Memory Leak Debugging

**Problem:** Server memory grows over time even with clearWindow() active.

**Diagnosis Steps:**

```bash
# 1. Check current metrics
curl https://your-api.com/api/internal/sanitizer-metrics

# Expected output:
{
  "memoryUsageMb": 45,
  "totalOperations": 12000,
  "averageTimeMs": 18
}

# 2. If memoryUsageMb is growing (>100MB):
# - Check if htmlSanitizerMiddleware is actually running
# - Verify clearWindow() is being called

# 3. View audit log to identify problematic requests
curl https://your-api.com/api/internal/audit-log?hours=1

# 4. If memory keeps growing:
# - Check if there are open handles/streams
# - Look for event listeners not being cleaned up
# - Review recent code changes to sanitization paths
```

**Code Inspection Checklist:**

```typescript
// ❌ WRONG: Doesn't call clearWindowState
export async function handleRequest() {
  const clean = sanitizeHtml(input);
  // Memory leak: jsdom state accumulates
}

// ✅ CORRECT: Middleware handles cleanup
app.use("*", htmlSanitizerMiddleware());  // Automatic clearWindow() after each request

// ️✅ ALSO CORRECT: Manual cleanup for batch operations
async function batchSanitize(items) {
  for (const item of items) {
    sanitizeHtml(item);
    
    if (items.indexOf(item) % 100 === 0) {
      clearWindowState();  // Reset every 100 items
    }
  }
}
```

**Monitoring Setup:**

```typescript
// Add to monitoring dashboard (e.g., datadog, prometheus)
setInterval(() => {
  const metrics = getGlobalMonitor().getMetrics();
  emit('histogram', 'sanitizer.memory_mb', metrics.memoryUsageMb);
  emit('counter', 'sanitizer.operations', metrics.totalOperations);
  emit('histogram', 'sanitizer.avg_time_ms', metrics.averageTimeMs);
}, 30000); // Every 30 seconds
```

### 4.2 DOMPurify Configuration Best Practices

**Guideline 1: Start Restrictive, Expand Gradually**

```typescript
// ❌ WRONG: Too permissive (XSS risk)
const config = {
  ALLOWED_TAGS: ['*'],  // ALL tags
  ALLOWED_ATTR: ['*'],  // ALL attributes
};

// ✅ CORRECT: Explicit whitelist
const config = {
  ALLOWED_TAGS: ['p', 'a', 'strong', 'em', 'ul', 'li'],
  ALLOWED_ATTR: ['href', 'title', 'rel'],
};

// ✅ ALSO GOOD: Use hooks for fine-grained control
registerLinkValidationHook({ whitelistedDomains: ['...'] });
```

**Guideline 2: Separate Configs Per Use Case**

```typescript
// For user comments (minimal):
const USER_COMMENT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  ALLOWED_ATTR: [],
};

// For email templates (more permissive):
const EMAIL_TEMPLATE_CONFIG = {
  ALLOWED_TAGS: ['table', 'td', 'tr', 'p', 'a', 'img', 'div', ...],
  ALLOWED_ATTR: ['href', 'alt', 'src', 'style', 'class', ...],
  ALLOW_DATA_ATTR: true,
};

// For rich text editors (controlled):
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'ul', 'ol', 'li', 'a', 'strong', ...],
  ALLOWED_ATTR: ['href', 'class', 'id'],
};
```

**Guideline 3: Version and Test Configuration Changes**

```typescript
// v1.0 - Initial config
// v1.1 - Added table support for email
// v1.2 - Added image handling with data URI validation

const CONFIG_VERSION = "1.2";

// Test new config before deploying:
const testCases = [
  { input: '<img src="x" onerror="alert(1)">', expected: '<img src="x" alt="">' },
  { input: '<a href="javascript:alert(1)">click</a>', expected: '<a>click</a>' },
  { input: '<iframe src="invalid.com"></iframe>', expected: '' },
];

for (const test of testCases) {
  const result = sanitize(test.input, EMAIL_TEMPLATE_CONFIG);
  console.assert(result === test.expected, `Failed: ${test.input}`);
}
```

### 4.3 Security Guidance for HTML Allowlist

**Dangerous Tags to Always Block:**

```typescript
// ❌ NEVER ALLOW:
const NEVER_ALLOW = [
  'script',           // Direct JS execution
  'iframe',           // Frame injection
  'object',           // Flash/plugins
  'embed',            // Plugins
  'applet',           // Java applets
  'meta',             // Charset injection
  'link',             // External resource injection
  'style',            // CSS injection (if not carefully validated)
  'form',             // CSRF vulnerability
  'input',            // Form injection
  'button',           // Button injection
];
```

**Dangerous Attributes to Always Block:**

```typescript
// ❌ NEVER ALLOW:
const NEVER_ALLOW_ATTRS = [
  'onclick',          // Event handlers
  'onmouseover',      // All on* attributes
  'onerror',
  'onload',
  'onchange',
  'onfocus',
  'onblur',
  'onkeydown',
  'javascript:',      // In href/src (DOMPurify blocks by default)
  'vbscript:',        // VBScript protocol
  'data:text/html',   // Data URIs with HTML
];
```

**Safe Attributes by Category:**

```typescript
// Links
ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],

// Tables (email)
ALLOWED_ATTR: ['colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing'],

// Styling (be careful!)
ALLOWED_ATTR: ['class', 'id', 'style'],  // only with curated CSS

// Media (if needed)
ALLOWED_ATTR: ['src', 'alt', 'width', 'height'],  // with origin validation
```

**Content Security Policy (CSP) Complementary:**

```typescript
// Set this header alongside DOMPurify sanitization
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';      // DOMPurify handles this
  img-src 'self' https: data:;
  style-src 'self' 'unsafe-inline';
  object-src 'none';
  frame-src 'none';
`;

// DOMPurify + CSP = Defense in Depth
```

**Testing Framework:**

```typescript
import { sanitize } from "isomorphic-dompurify";

describe("DOMPurify Security", () => {
  const xssPayloads = [
    '<img src=x onerror="alert(1)">',
    '<svg/onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '<input onfocus="alert(1)" autofocus>',
    '<marquee onstart="alert(1)">',
    '<div style="background:url(javascript:alert(1))">',
  ];

  xssPayloads.forEach((payload) => {
    test(`blocks payload: ${payload}`, () => {
      const result = sanitize(payload, CONFIG);
      expect(result).not.toContain("alert");
      expect(result).not.toContain("javascript:");
      expect(result).not.toContain("onerror");
    });
  });
});
```

---

## Troubleshooting & Debugging

### Issue: Rate Limiter Always Triggering

**Symptom:** 429 Too Many Requests errors for legitimate traffic

**Solution:**

```typescript
// Increase limits based on actual usage
const monitor = new SanitizationMonitor();
// Default: 1000 ops/minute

// Check actual usage:
const metrics = monitor.getMetrics();
console.log(`Ops/sec: ${metrics.totalOperations / uptime_seconds}`);

// Adjust if needed:
import { SanitizationRateLimiter } from "../lib/sanitizer-metrics";
const limiter = new SanitizationRateLimiter(60000, 5000); // 5000/min instead
```

### Issue: clearWindow() Removes Custom Hooks

**Symptom:** Link validation suddenly stops working after some requests

**Root Cause:** clearWindow() clears ALL hooks. Must re-register.

**Solution:**

```typescript
// ❌ WRONG: Register hook once
registerLinkValidationHook(config);

// ✅ CORRECT: Re-register after clearWindow
function clearWindowState() {
  clearAllHooks();
  clearWindow();
  
  // Re-register all hooks needed
  registerLinkValidationHook(linkConfig);
  registerClassPreservationHook(allowedClasses);
}

// ️✅ OR: Use middleware (handles automatically)
app.use("*", htmlSanitizerMiddleware()); // Manages hook lifecycle
```

### Issue: Memory Still Growing

**Checklist:**

1. Is `htmlSanitizerMiddleware` registrered globally?
   ```typescript
   app.use("*", htmlSanitizerMiddleware()); // Line 87 in app.ts
   ```

2. Are there multiple sanitizers running?
   ```bash
   grep -r "sanitize(" apps/api/src/ | grep -v test | grep -v "sanitize(input"
   ```

3. Is clearWindow() a true no-op in the environment?
   ```typescript
   import { clearWindow } from "isomorphic-dompurify";
   clearWindow(); // Should be instant
   ```

4. Check jsdom version compatibility:
   ```bash
   npm list jsdom  # Should be v28+
   ```

---

## Summary Table

| Phase | Feature | File | Status |
|-------|---------|------|--------|
| 2 | Custom Hooks | `sanitizer-hooks.ts` | ✅ Implemented |
| 2 | Rate Limiting | `sanitizer-metrics.ts` | ✅ Implemented |
| 2 | Audit Logs | `sanitizer-metrics.ts` | ✅ Implemented |
| 2 | Memory Tracking | `sanitizer-metrics.ts` | ✅ Implemented |
| 3 | User Content | `routes/calendar.ts` | 📋 Guide Provided |
| 3 | Email Sanitization | `services/email.ts` | 📋 Guide Provided |
| 3 | Notifications | `routes/notifications.ts` | 📋 Guide Provided |
| 4 | Memory Debugging | This Doc | ✅ Documented |
| 4 | Config Best Practices | This Doc | ✅ Documented |
| 4 | Security Guidance | This Doc | ✅ Documented |

---

**Next Steps:**

1. ✅ Read Phase 2 features above
2. ✅ Review Phase 3 integration patterns for your use cases
3. ✅ Implement Phase 4 security best practices
4. 📊 Monitor memory metrics in production
5. 🔍 Run security tests from Phase 4.3
