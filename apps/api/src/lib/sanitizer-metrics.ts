/**
 * Sanitizer Metrics & Monitoring - Rate Limiting + Audit Logs
 *
 * Tracks:
 * - Sanitization operations (count, frequency)
 * - Memory usage (jsdom state)
 * - Rate limiting (prevent DoS)
 * - Audit trail (what was sanitized, when)
 */

export interface SanitizationMetrics {
  totalOperations: number;
  operationsLastHour: number;
  averageTimeMs: number;
  lastOperationAt: Date | null;
  memoryUsageMb: number;
}

export interface AuditLogEntry {
  timestamp: Date;
  operation: "sanitize" | "clear" | "hook_register";
  inputLength: number;
  outputLength: number;
  durationMs: number;
  userId?: string;
  context?: string;
}

/**
 * Rate limiter for sanitization operations
 * Prevents DoS attacks by limiting calls per time window
 */
export class SanitizationRateLimiter {
  private operations: number[] = [];
  private readonly windowMs: number;
  private readonly maxOperations: number;

  constructor(windowMs: number = 60000, maxOperations: number = 1000) {
    this.windowMs = windowMs;
    this.maxOperations = maxOperations;
  }

  /**
   * Check if operation is allowed and record it
   */
  isAllowed(): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Remove old operations outside the window
    this.operations = this.operations.filter((timestamp) => timestamp > cutoff);

    // Check limit
    if (this.operations.length >= this.maxOperations) {
      return false;
    }

    // Record new operation
    this.operations.push(now);
    return true;
  }

  /**
   * Get current operation count in window
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Reset counter
   */
  reset(): void {
    this.operations = [];
  }
}

/**
 * Audit logger for sanitization operations
 * Tracks all sanitization calls for compliance/debugging
 */
export class SanitizationAuditLog {
  private entries: AuditLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a sanitization operation
   */
  log(entry: Omit<AuditLogEntry, "timestamp">): void {
    const fullEntry: AuditLogEntry = {
      timestamp: new Date(),
      ...entry,
    };

    this.entries.push(fullEntry);

    // Keep circular buffer size manageable
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
   * Get all entries
   */
  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries from last N hours
   */
  getRecentEntries(hoursBack: number): AuditLogEntry[] {
    const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;
    return this.entries.filter((e) => e.timestamp.getTime() > cutoff);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalEntries: number;
    averageDurationMs: number;
    totalInputBytes: number;
    totalOutputBytes: number;
  } {
    if (this.entries.length === 0) {
      return {
        totalEntries: 0,
        averageDurationMs: 0,
        totalInputBytes: 0,
        totalOutputBytes: 0,
      };
    }

    const totalDuration = this.entries.reduce((sum, e) => sum + e.durationMs, 0);
    const totalInput = this.entries.reduce((sum, e) => sum + e.inputLength, 0);
    const totalOutput = this.entries.reduce((sum, e) => sum + e.outputLength, 0);

    return {
      totalEntries: this.entries.length,
      averageDurationMs: totalDuration / this.entries.length,
      totalInputBytes: totalInput,
      totalOutputBytes: totalOutput,
    };
  }
}

/**
 * Memory metrics tracker for jsdom sanitization
 */
export class SanitizationMemoryMetrics {
  private startMemory: number = 0;
  private operationCount: number = 0;
  private totalDurationMs: number = 0;

  constructor() {
    if (typeof process !== "undefined" && process.memoryUsage) {
      this.startMemory = process.memoryUsage().heapUsed;
    }
  }

  /**
   * Record sanitization operation timing
   */
  recordOperation(durationMs: number): void {
    this.operationCount += 1;
    this.totalDurationMs += durationMs;
  }

  /**
   * Get current metrics
   */
  getMetrics(): SanitizationMetrics {
    const currentMemory =
      typeof process !== "undefined" && process.memoryUsage ? process.memoryUsage().heapUsed : 0;

    return {
      totalOperations: this.operationCount,
      operationsLastHour: this.operationCount, // Would need timestamp tracking for accurate per-hour
      averageTimeMs:
        this.operationCount > 0 ? Math.round(this.totalDurationMs / this.operationCount) : 0,
      lastOperationAt: new Date(),
      memoryUsageMb: Math.round((currentMemory - this.startMemory) / 1024 / 1024),
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.operationCount = 0;
    this.totalDurationMs = 0;
    if (typeof process !== "undefined" && process.memoryUsage) {
      this.startMemory = process.memoryUsage().heapUsed;
    }
  }
}

/**
 * Integrated monitoring system combining rate limiting, audit, and metrics
 */
export class SanitizationMonitor {
  private rateLimiter: SanitizationRateLimiter;
  private auditLog: SanitizationAuditLog;
  private metrics: SanitizationMemoryMetrics;

  constructor() {
    this.rateLimiter = new SanitizationRateLimiter();
    this.auditLog = new SanitizationAuditLog();
    this.metrics = new SanitizationMemoryMetrics();
  }

  /**
   * Check if operation is allowed and log it
   */
  checkAndLog(
    operation: "sanitize" | "clear" | "hook_register",
    inputLength: number,
    outputLength: number,
    durationMs: number,
    userId?: string,
  ): { allowed: boolean; reason?: string } {
    if (!this.rateLimiter.isAllowed()) {
      return {
        allowed: false,
        reason: "Rate limit exceeded",
      };
    }

    this.auditLog.log({
      operation,
      inputLength,
      outputLength,
      durationMs,
      userId,
    });

    this.metrics.recordOperation(durationMs);

    return { allowed: true };
  }

  /**
   * Get all metrics
   */
  getMetrics(): SanitizationMetrics {
    return this.metrics.getMetrics();
  }

  /**
   * Get audit entries from last N hours
   */
  getAuditEntries(hoursBack: number = 1): AuditLogEntry[] {
    return this.auditLog.getRecentEntries(hoursBack);
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.rateLimiter.reset();
    this.auditLog.clear();
    this.metrics.reset();
  }
}

// Global singleton instance
let globalMonitor: SanitizationMonitor | null = null;

/**
 * Get or create global monitor instance
 */
export function getGlobalMonitor(): SanitizationMonitor {
  if (!globalMonitor) {
    globalMonitor = new SanitizationMonitor();
  }
  return globalMonitor;
}
