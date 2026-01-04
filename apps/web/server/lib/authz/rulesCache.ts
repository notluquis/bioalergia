// server/lib/authz/rulesCache.ts

// Generic rule type for caching
interface CachedRule {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
}

const cache = new Map<string, { rules: CachedRule[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: number, version: number) {
  return `${userId}:${version}`;
}

export function getCachedRules(userId: number, version: number): CachedRule[] | null {
  const key = getCacheKey(userId, version);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.rules;
  }

  cache.delete(key);
  return null;
}

export function setCachedRules(userId: number, version: number, rules: CachedRule[]) {
  const key = getCacheKey(userId, version);
  cache.set(key, { rules, timestamp: Date.now() });
}
