# Build Optimizations - Railway Deploy

## Current Performance (Jan 2026)

**Baseline**: ~74s total build time (after initial optimization from 80s)

### Breakdown:
- Vite build (web): ~22s (30% of total)
- API TypeScript: ~6s (8%)
- DB ZenStack: ~6s (8%)
- pnpm install/deploy: ~7s (9%)
- Docker operations: ~33s (45%)

---

## Implemented Optimizations (Jan 2026)

### 1. **Vite Build Cache** (Target: -5s on rebuilds)
```dockerfile
RUN --mount=type=cache,id=...-vite,target=/app/apps/web/node_modules/.vite \
    pnpm --filter @finanzas/web build
```
**Impact**: Caches Vite's internal dependency pre-bundling. First build unchanged, subsequent builds faster.

### 2. **TypeScript Incremental Builds** (Target: -2-3s on rebuilds)
```json
// tsconfig.json
"incremental": true,
"tsBuildInfoFile": "../../.tsbuildinfo/web.tsbuildinfo"
```
```dockerfile
RUN --mount=type=cache,id=...-tsbuildinfo,target=/app/.tsbuildinfo \
    pnpm build
```
**Impact**: TypeScript caches type-checking results. Rebuilds only changed files.

### 3. **Strategic Vite Chunking** (Target: -2-3s)
```typescript
// vite.config.ts
manualChunks: {
  vendor: ['react', 'react-dom', 'react-router-dom'],
  charts: ['recharts'],
  utils: ['dayjs', 'zod', 'decimal.js'],
}
```
**Impact**: Reduces Rollup graph complexity. Fewer chunks = faster analysis.

### 4. **Existing Optimizations** (Already in place)
- ✅ Parallel builds (web + api)
- ✅ `reportCompressedSize: false` (skip gzip calc)
- ✅ pnpm store cache
- ✅ Multi-stage Docker build
- ✅ esbuild minification (fastest)
- ✅ `sourcemap: false` in production

---

## Expected Results

### First Build (Cold Cache)
- **Before**: 74s
- **After**: 74s (no change, cache empty)

### Subsequent Builds (Warm Cache)
- **Before**: 74s
- **After**: ~64-67s (estimated -7 to -10s)

### Breakdown:
```
Vite build:     22s → 17s (-5s from cache)
TypeScript:      6s →  4s (-2s from incremental)
Rollup chunks:  Included in Vite time (-2-3s from strategic chunking)
```

---

## Future Optimization Ideas

### 🔴 High Impact (Not Yet Implemented)
1. **swc-loader for TypeScript**: Replace `tsc` with `swc` (5-10x faster)
   - Risk: swc type-checking less strict than tsc
   - Alternative: Keep tsc for CI, use swc only for build

2. **Parallel ZenStack + Web/API**: Currently sequential
   ```dockerfile
   RUN pnpm --filter @finanzas/db build &
   RUN pnpm --filter @finanzas/web --filter @finanzas/api build &
   wait
   ```
   - Risk: Dependency issues if db needs to finish first

3. **Turborepo Remote Cache**: Cache build artifacts across deploys
   - Requires: Turbo account + secret management
   - Impact: Up to 50% reduction on unchanged builds

### 🟡 Medium Impact
4. **esbuild for TypeScript**: Replace Vite's esbuild+tsc with pure esbuild
   - Gain: ~30% faster TypeScript compilation
   - Loss: No type-checking (must run `tsc --noEmit` separately)

5. **Optimize DaisyUI**: Use PurgeCSS more aggressively
   - Current CSS bundle: ~214KB
   - Potential savings: ~50KB (-23%)

6. **Reduce Recharts Bundle**: Consider lightweight alternative
   - Current: recharts (~381KB chunk)
   - Alternative: chart.js (~70KB) or uPlot (~40KB)

### 🟢 Low Impact
7. **Node 25 native test runner**: Replace Vitest with Node native
   - Gain: Smaller dependencies, faster install
   - Loss: Developer experience (Vitest is better)

8. **Bun**: Replace Node with Bun runtime
   - Gain: 2-3x faster JavaScript execution
   - Risk: Bun compatibility with native modules (argon2, etc.)

---

## Monitoring Build Performance

### Manual Testing
```bash
# Build locally with Docker
docker build -t finanzas-test .

# Time it
time docker build -t finanzas-test .
```

### Railway Logs
Look for these timestamps in Railway build logs:
```
[build X/13] RUN pnpm --filter @finanzas/web build
```

### Key Metrics to Track
- **Total build time**: Start to "Healthcheck succeeded"
- **Vite build time**: `apps/web build: ✓ built in X.XXs`
- **TypeScript time**: `apps/api build: Done` - `apps/api build$` start
- **Image size**: Final Docker image (should be ~150-180MB)

---

## Build Time Goals

| Phase | Baseline (Jan 2026) | Target Q1 2026 | Stretch Goal |
|-------|---------------------|----------------|---------------|
| First build (cold) | 74s | 70s (-5%) | 60s (-19%) |
| Rebuild (warm cache) | 74s | 65s (-12%) | 55s (-26%) |
| PR builds (Turbo cache) | 74s | 40s (-46%) | 30s (-59%) |

---

## Constraints

### CANNOT Change:
1. **PostgreSQL**: Database must stay PostgreSQL (not MySQL)
2. **ZenStack 3.1.1**: ORM must stay ZenStack (ABAC policies)
3. **React 19 Compiler**: Must maintain compiler optimizations
4. **DaisyUI**: Design system is locked
5. **Vite 7**: Official plugins only (no third-party Rollup)

### MAY Change (With Testing):
1. TypeScript compiler (swc/esbuild)
2. Bundler (Vite → Turbopack if React 19 compatible)
3. Runtime (Node → Bun)
4. Charts library (Recharts → lighter alternative)

---

## Rollback Plan

If build optimizations cause issues:

```bash
# 1. Revert Dockerfile changes
git revert <commit-hash>

# 2. Remove incremental build configs
# Edit tsconfig.json, remove "incremental" and "tsBuildInfoFile"

# 3. Revert Vite config
# Edit vite.config.ts, remove manualChunks

# 4. Push
git push origin forthcoming-ocelot
```

Railway will auto-deploy the reverted version.

---

_Last updated: January 7, 2026_
_Author: GitHub Copilot + notluquis_
