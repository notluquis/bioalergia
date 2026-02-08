# Memory Leak Debugging Runbook for DOMPurify

**Created:** February 7, 2026 | **Last Updated:** February 7, 2026 | **Severity:** Critical

---

## Quick Diagnosis Flowchart

```
Memory usage growing over time?
  └─→ YES
       └─→ Check if htmlSanitizerMiddleware is active in app.ts?
            ├─→ NO: Add middleware NOW (line 87)
            │
            └─→ YES: Check clearWindow() execution
                 ├─→ Add logging to verify calls
                 │   ```typescript
                 │   export function clearWindowState() {
                 │     console.log("clearWindow called");
                 │     clearAllHooks();
                 │     clearWindow();
                 │   }
                 │   ```
                 │
                 └─→ Check if memory tracking shows increasing operations
                      ├─→ Operations normal, memory still growing
                      │   └─→ Likely JS/CSS parser accumulation
                      │       └─→ See: "DOMPurify Parser Cache Tuning"
                      │
                      └─→ Operations growing, memory growing proportionally
                          └─→ Expected behavior (more sanitizations = more memory)
                              └─→ Increase rate limiter thresholds
                              └─→ Or cache sanitized results
```

---

## Severity Levels

### 🔴 CRITICAL (Immediate Action Required)

**Memory >500MB** or **growing >50MB/hour**

```bash
# 1. Scale down affected pods
kubectl scale deploy api --replicas=1

# 2. Drain old pods
kubectl delete pod <pod-name>

# 3. Enable memory limit enforcement
# In railway.json or docker config:
export MEMORY_LIMIT="512m"
export NODE_MAX_OLD_SPACE_SIZE="256"
node --max-old-space-size=256 dist/index.js

# 4. Monitor new instance
watch -n 5 "curl https://api/metrics | jq '.memory'"

# 5. If stabilizes: root cause found in code
# If still growing: infrastructure/environment issue
```

### 🟡 WARNING (Investigate Next Day)

**Memory >200MB** or **growing >10MB/hour**

```bash
# 1. Enable detailed logging
export DEBUG="*sanitizer*"

# 2. Capture audit log samples
curl https://api/api/internal/audit-log?hours=1 > audit-log.json

# 3. Identify heavy requests
jq '.[] | select(.inputLength > 100000)' audit-log.json

# 4. Review changes made in last deployment
git log --oneline -10 -- apps/api/src/lib/
```

### 🟢 INFO (Monitor but No Action)

**Memory <100MB** or **stable growth <2MB/hour**

```bash
# 1. Set up alerts
alert if memory > 150MB
alert if growth_rate > 5MB/hour

# 2. Schedule weekly review
```

---

## Step-by-Step Diagnosis

### Step 1: Identify the Problem

```bash
# 1a. Get baseline memory
curl -s https://api.bioalergia.cl/api/internal/sanitizer-metrics | jq '.memoryUsageMb'
# Expected: 40-80 MB initially

# 1b. Run load test (100 requests)
for i in {1..100}; do
  curl -X POST https://api.bioalergia.cl/api/calendar/events/classify \
    -H "Content-Type: application/json" \
    -d '{"html":"<p>Test event with some content</p>"}'
done

# 1c. Check memory after load test
curl -s https://api.bioalergia.cl/api/internal/sanitizer-metrics | jq '.memoryUsageMb'
# Should return to baseline within 30 seconds if clearWindow() works
```

**Expected Behavior:**

```
Before: 45 MB
After 100 requests: 120 MB (peak)
After 30 seconds: 48 MB (back to normal)
✅ HEALTHY
```

**Problematic Behavior:**

```
Before: 45 MB
After 100 requests: 120 MB
After 30 seconds: 115 MB (doesn't drop)
After 1 hour: 250 MB
❌ MEMORY LEAK DETECTED
```

### Step 2: Verify Middleware Installation

```bash
# 2a. Check if middleware is registered
grep -n "htmlSanitizerMiddleware" apps/api/src/app.ts

# Expected: Should see line like:
# app.use("*", htmlSanitizerMiddleware());
```

**If NOT found:**

```typescript
// Add to apps/api/src/app.ts (around line 87):
import { htmlSanitizerMiddleware } from "./lib/html-sanitizer";

app.use("*", htmlSanitizerMiddleware());
```

**If found but still leaking:**

```bash
# 2b. Check if middleware is before or after other middleware
# that might bypass it
grep -B5 -A5 "htmlSanitizerMiddleware" apps/api/src/app.ts

# Rule: It should be EARLY in middleware chain, but after:
# - Error handlers
# - Authentication
# - Logging (optional)

# It should be BEFORE:
# - Route handlers
# - File uploads
```

### Step 3: Check clearWindow() Execution

```typescript
// apps/api/src/lib/html-sanitizer.ts - Add debugging

export function htmlSanitizerMiddleware() {
  return async (c: Context, next: Next) => {
    const startMem = process.memoryUsage().heapUsed / 1024 / 1024;
    
    await next();
    
    try {
      clearWindowState();  // Add logging here
      const endMem = process.memoryUsage().heapUsed / 1024 / 1024;
      
      if (Math.abs(endMem - startMem) > 10) {
        console.warn(
          `Memory delta: ${(endMem - startMem).toFixed(2)}MB ` +
          `for request: ${c.req.path()}`
        );
      }
    } catch (error) {
      console.error("Error in clearWindowState:", error);
    }
  };
}
```

### Step 4: Analyze Audit Log

```bash
# 4a. Fetch last hour of audit log
curl -s https://api.bioalergia.cl/api/internal/audit-log?hours=1 \
  > audit-log.json

# 4b. Find requests that consume memory
jq '.[] | 
  select(.inputLength > 50000) |
  {
    timestamp,
    operation,
    inputLength,
    outputLength,
    durationMs,
    userId
  }' audit-log.json | head -20

# 4c. Check for anomalies
jq '[.[] | .inputLength] | max' audit-log.json
# If max > 1M: Someone sending huge payloads
```

**What to Look For:**

```json
{
  "operation": "sanitize",
  "inputLength": 500000,      // 500KB input
  "outputLength": 50000,      // 90% stripped (good)
  "durationMs": 145,
  "userId": "user-abc"
}
```

- ✅ Small output/input ratio: Normal (lots removed)
- ❌ Large output/input ratio: Possible XSS attempt
- ❌ Long duration (>500ms): Regex DoS possibility
- ❌ Huge inputs (>1MB): Spam/attack indicator

### Step 5: Check For Regex DoS

DOMPurify uses complex regex for parsing. Malformed HTML can cause exponential backtracking.

```bash
# 5a. Look for requests with long duration but similar input size
jq '.[] | 
  select(.durationMs > 500) |
  {
    durationMs,
    inputLength,
    operation
  }' audit-log.json

# 5b. If found excessive durations:
# - Check rate limiter for "regex_timeout" events
# - Review recent DOMPurify config changes
```

**Example Problematic Input:**

```html
<!-- This can cause regex backtracking -->
<p>
  <span><span><span><span><span><span><span>
    <!-- Deeply nested unclosed tags -->
```

**Prevention:**

```typescript
// Limit max input length
if (html.length > 1_000_000) {  // 1MB limit
  throw new Error("Input exceeds maximum length");
}

// Limit depth
const depth = (html.match(/</g) || []).length;
if (depth > 1000) {  // More than 1000 tags
  throw new Error("Input depth exceeds maximum");
}
```

### Step 6: Profile Heap Usage

```bash
# 6a. Enable heap snapshots
export ENABLE_HEAP_SNAPSHOT=true

# 6b. Get heap dump via diagnostics channel
# In your monitoring service:
const diagnostics = require('diagnostics_channel');
diagnostics.channel('node.gc').subscribe(({ kind, flags }) => {
  if (kind === 0) {  // Start of GC
    console.log('GC started');
  }
});

# 6c. Or use V8 profiler
node --prof dist/index.js

# Wait 5 minutes, then:
node --prof-process isolate-*.log | head -50
```

**Interpreting Output:**

```
[Summary]:
Ticks  Per call
100         5   C++ -> JS function calls
 50        2.5  Non-inlined function calls
 
[Heavy (>2% self ticks)]:
210  4.5%  /path/to/dompurify/sanitize  ← Most time here
 89  1.9%  /path/to/parser              ← Second most
 
[GC]:
194 ticks (GC) – Memory being freed aggressively
```

- If DOMPurify takes >10% of CPU: Possibly regex DoS
- If GC ticks are frequent: Parser cache growing

---

## Common Root Causes & Fixes

### Issue 1: clearWindow() Not Being Called

**Symptom:**
```
Memory: 45MB → 500MB over 2 hours steady
```

**Diagnosis:**

```bash
# Check if middleware is actually executing
# Add console.log and restart

# In app.ts, add around line 87:
console.log("Middleware: htmlSanitizerMiddleware starting");
app.use("*", htmlSanitizerMiddleware());
console.log("Middleware: htmlSanitizerMiddleware registered");

# Restart and check logs
# If doesn't appear: Middleware registration failed

# Check for export errors
pnpm build apps/api --verbose 2>&1 | grep -i "error\|import"
```

**Fix:**

```typescript
// 1. Verify import exists
import { htmlSanitizerMiddleware } from "./lib/html-sanitizer";

// 2. Check htmlSanitizerMiddleware is exported
// In html-sanitizer.ts:
export function htmlSanitizerMiddleware() {
  return async (c: Context, next: Next) => {
    // ...
    clearWindowState();
  };
}

// 3. Place early in middleware chain
const app = new Hono();
// ... auth, error handlers ...
app.use("*", htmlSanitizerMiddleware());  // Early!
// ... routes ...
```

### Issue 2: clearWindow() Clearing Custom Hooks Too Early

**Symptom:**
```
Memory normal at first
Then link validation stops working
Then memory climbs
```

**Root Cause:**

```typescript
// ❌ WRONG: clearWindow() clears hooks
export function clearWindowState() {
  clearWindow();  // This removes ALL hooks!
}

// Then hook registration is skipped because it was one-time at startup
registerLinkValidationHook(config);  // Never called again
```

**Fix:**

```typescript
// ✅ CORRECT: Re-register hooks after clearWindow
export function clearWindowState() {
  clearAllHooks();
  clearWindow();
  
  // Re-register hooks
  registerLinkValidationHook(globalLinkConfig);
  registerAuditHook();
  registerDataAttributePreservationHook();
}

// OR use a hook manager:
const hookManager = {
  config: {},
  
  registerHooks(config) {
    this.config = config;
    registerLinkValidationHook(config.links);
    // ...
  },
  
  reregisterHooks() {
    this.registerHooks(this.config);
  }
};

// In clearWindowState:
clearAllHooks();
clearWindow();
hookManager.reregisterHooks();
```

### Issue 3: Caching Sanitized Results Causes Memory Growth

**Symptom:**
```
Cache size grows with each unique request
Memory never drops
```

**Root Cause:**

```typescript
// ❌ WRONG: Cache without size limit
const sanitizationCache = new Map();

export function getCachedSanitization(html: string) {
  if (sanitizationCache.has(html)) {
    return sanitizationCache.get(html);
  }
  
  const result = sanitizeHtml(html);
  sanitizationCache.set(html, result);  // Unbounded growth!
  return result;
}
```

**Fix:**

```typescript
// ✅ CORRECT: LRU cache with size limit
import LRU from 'lru-cache';

const sanitizationCache = new LRU({
  max: 1000,           // Max 1000 entries
  maxSize: 100 * 1024 * 1024,  // Max 100MB
  sizeCalculation: (entry) => JSON.stringify(entry).length,
  ttl: 1000 * 60 * 60  // 1 hour expiry
});

export function getCachedSanitization(html: string) {
  if (sanitizationCache.has(html)) {
    return sanitizationCache.get(html);
  }
  
  const result = sanitizeHtml(html);
  sanitizationCache.set(html, result);
  return result;
}
```

### Issue 4: Regex DoS (Denial of Service)

**Symptom:**
```
Single request takes 30+ seconds
Memory spikes to 200MB for one request
```

**Diagnosis:**

```bash
# Monitor request duration
jq '.[] | 
  select(.durationMs > 1000) |
  {
    durationMs,
    inputLength
  }' audit-log.json

# If duration is 30+ seconds for 100KB: Likely regex DoS
```

**Root Cause:**

Deeply nested unclosed tags cause exponential backtracking in DOMPurify regex.

**Fix:**

```typescript
// 1. Validate input structure BEFORE sanitization
function validateInput(html: string) {
  // Count opening vs closing tags
  const opens = (html.match(/<[^/]/g) || []).length;
  const closes = (html.match(/<\//g) || []).length;
  
  if (opens - closes > 100) {
    throw new Error("Too many unclosed tags");
  }
  
  // Check nesting depth
  let depth = 0;
  let maxDepth = 0;
  for (const char of html) {
    if (html[i] === '<') depth++;
    if (html[i] === '>') depth--;
    maxDepth = Math.max(maxDepth, depth);
  }
  
  if (maxDepth > 50) {
    throw new Error("Nesting too deep");
  }
}

// 2. Apply timeout to sanitization
export function sanitizeHtmlWithTimeout(html: string, maxMs = 1000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn("Sanitization timeout");
      resolve("");  // Return empty string on timeout
    }, maxMs);
    
    try {
      const result = sanitizeHtml(html);
      clearTimeout(timeout);
      resolve(result);
    } catch (error) {
      clearTimeout(timeout);
      resolve("");
    }
  });
}

// 3. Use in routes
app.post("/api/sanitize", async (c) => {
  const html = c.req.json().html;
  
  try {
    validateInput(html);  // Fail fast
    const clean = await sanitizeHtmlWithTimeout(html, 500);
    
    if (!clean) {
      return c.json({ error: "Sanitization timeout" }, { status: 400 });
    }
    
    return c.json({ sanitized: clean });
  } catch (error) {
    return c.json({ error: error.message }, { status: 400 });
  }
});
```

---

## Monitoring & Alerting

### Prometheus Metrics

```typescript
import prometheus from 'prom-client';

const sanitizationMemory = new prometheus.Gauge({
  name: 'sanitizer_memory_mb',
  help: 'Current memory used by sanitizer',
});

const sanitizationOps = new prometheus.Counter({
  name: 'sanitizer_operations_total',
  help: 'Total sanitization operations',
});

const sanitizationDuration = new prometheus.Histogram({
  name: 'sanitizer_duration_ms',
  help: 'Sanitization operation duration',
  buckets: [10, 50, 100, 500, 1000],
});

// In metrics endpoint
app.get('/metrics', (c) => {
  const metrics = getGlobalMonitor().getMetrics();
  sanitizationMemory.set(metrics.memoryUsageMb);
  sanitizationOps.set(metrics.totalOperations);
  
  return c.text(prometheus.register.metrics());
});
```

### Grafana Alert Rules

```yaml
groups:
  - name: sanitizer
    rules:
      - alert: SanitizerMemoryHigh
        expr: sanitizer_memory_mb > 200
        for: 5m
        annotations:
          summary: "Sanitizer memory > 200MB"
          action: "Check memory leaks, Scale down pods"
      
      - alert: SanitizerMemoryGrowth
        expr: rate(sanitizer_memory_mb[1h]) > 5
        for: 10m
        annotations:
          summary: "Sanitizer memory growing >5MB/hour"
          action: "Review clearWindow() implementation"
      
      - alert: SanitizerHighLatency
        expr: sanitizer_duration_ms_p99 > 500
        for: 5m
        annotations:
          summary: "Sanitizer p99 latency > 500ms"
          action: "Check for regex DoS attacks"
```

---

## Recovery Procedures

### Quick Recovery (Service Still Up)

```bash
# 1. Reduce traffic
kubectl scale deploy api --replicas replicas=1

# 2. Enable aggressive GC
export NODE_OPTIONS="--expose-gc"
npm install -g gc-stats
node --expose-gc dist/index.js

# 3. Manual memory dump
curl -X POST https://api/api/internal/force-gc

# 4. Monitor recovery
watch -n 2 "curl -s https://api/metrics | jq '.memory'"

# 5. If stabilizes in 5 minutes: Restart safe
kubectl rollout restart deploy api

# 6. If still growing: Rollback last changes
git revert -n <commit>
pnpm build && docker build -t api:rollback .
```

### Emergency Recovery (Service Down)

```bash
# 1. Scale to zero
kubectl scale deploy api --replicas=0

# 2. Check recent commits
git log --oneline apps/api/src/lib/ -20

# 3. Rollback to last known good
git checkout <good-commit> apps/api/

# 4. Rebuild and redeploy
pnpm build
docker build -t api:$(date +%s) .
kubectl scale deploy api --replicas=2

# 5. Monitor
watch -n 5 "kubectl top pod | grep api"

# 6. Post-mortem: What changed?
git diff <good-commit>..<bad-commit> apps/api/src/lib/
```

---

## Preventive Measures

### Code Review Checklist

Before merging any PR that touches `sanitizer*` files:

- [ ] Does it call `clearWindowState()` after batch operations?
- [ ] Does it re-register hooks after `clearWindow()`?
- [ ] Does it validate input size limits?
- [ ] Does it have timeout protection?
- [ ] Does it include audit logging?
- [ ] Does it update tests with memory assertions?

### Test Template

```typescript
import { getProcessMemory } from "../lib/memory-utils";

describe("Sanitizer Memory", () => {
  it("should not leak memory on repeated sanitizations", async () => {
    const startMem = getProcessMemory();
    
    for (let i = 0; i < 1000; i++) {
      sanitizeHtml("<p>Test content</p>");
    }
    
    // Force GC
    if (global.gc) global.gc();
    
    const endMem = getProcessMemory();
    const delta = endMem - startMem;
    
    // Should use <5MB for 1000 small sanitizations
    expect(delta).toBeLessThan(5);
  });
});
```

---

## Quick Reference

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Memory sustained >200MB | `clearWindow()` not called | Add middleware |
| Memory spikes then normalizes | Normal (batch operation) | Accept, monitor trend |
| Link validation stops working | Hooks cleared, not re-registered | Re-register in `clearWindowState()` |
| Single request very slow (>1s) | Regex DoS attack | Add input validation + timeout |
| GC running constantly | Cache unbounded | Use LRU cache |
| Memory grows steadily 50MB/hour | Normal load accumulation | Increase clearWindow() frequency or rate limit |

---

**Last Updated:** February 7, 2026  
**Version:** 1.0  
**Maintainer:** DevOps Team  
**Next Review:** February 14, 2026
