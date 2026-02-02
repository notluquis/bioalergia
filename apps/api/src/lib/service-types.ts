/**
 * Service Type Foundation
 *
 * This file defines the base types that will be used across all services
 * to eliminate `any` types and ensure type safety throughout the refactoring sprint.
 *
 * Based on official documentation:
 * - Zenstack v3: https://zenstack.dev/docs/reference/model-queries
 * - Hono: https://hono.dev/docs/api/context
 * - ZenStackClient: @zenstackhq/orm - type-safe ORM
 */

// NOTE: Zenstack v3 generates types in @finanzas/db
// Import specific types like: RoleCreateArgs, RoleUpdateArgs, etc.
// Then extract with: type RoleCreateInput = NonNullable<RoleCreateArgs['data']>

// ============================================================================
// ZENSTACK V3 TYPE PATTERNS
// ============================================================================

/**
 * Generic helper to extract 'data' field from Zenstack *CreateArgs types
 *
 * Usage:
 * ```typescript
 * import type { RoleCreateArgs } from '@finanzas/db'
 *
 * type RoleCreateInput = ExtractCreateData<RoleCreateArgs>
 * ```
 */
export type ExtractCreateData<T extends { data?: unknown }> = NonNullable<T["data"]>;

/**
 * Generic helper to extract 'data' field from Zenstack *UpdateArgs types
 *
 * Usage:
 * ```typescript
 * import type { RoleUpdateArgs } from '@finanzas/db'
 *
 * type RoleUpdateInput = ExtractUpdateData<RoleUpdateArgs>
 * ```
 */
export type ExtractUpdateData<T extends { data?: unknown }> = NonNullable<T["data"]>;

/**
 * Generic where input type
 * Zenstack exports these as: ${Model}WhereInput
 */
export type GenericWhereInput = Record<string, unknown>;

/**
 * Generic find args type
 * Zenstack exports these as: ${Model}FindManyArgs, ${Model}FindUniqueArgs
 */
export type GenericFindManyArgs = Record<string, unknown>;
export type GenericFindUniqueArgs = Record<string, unknown>;

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Discriminated union for error handling.
 * Replaces catch(error: any) patterns.
 *
 * Usage in code:
 * - try block with operation
 * - catch block with parseError(error)
 * - result is properly typed as ServiceError
 */
export type ServiceError =
  | {
      type: "prisma_error";
      code: string;
      message: string;
      meta?: Record<string, unknown>;
    }
  | {
      type: "validation_error";
      message: string;
      details: Record<string, unknown>;
    }
  | {
      type: "not_found_error";
      resource: string;
      id: string | number;
    }
  | {
      type: "permission_error";
      message: string;
    }
  | {
      type: "unknown_error";
      message: string;
    };

/**
 * Parse caught error into typed ServiceError.
 * This function replaces `catch (error: any)` by providing type safety.
 */
export function parseError(error: unknown): ServiceError {
  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return {
      type: "prisma_error",
      code: error.code,
      message: error instanceof Error ? error.message : String(error),
      meta:
        "meta" in error && typeof error.meta === "object"
          ? (error.meta as Record<string, unknown>)
          : undefined,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    if (error.name === "ValidationError") {
      return {
        type: "validation_error",
        message: error.message,
        details: {},
      };
    }
    if (error.message.includes("not found")) {
      return {
        type: "not_found_error",
        resource: "unknown",
        id: "unknown",
      };
    }
    return {
      type: "unknown_error",
      message: error.message,
    };
  }

  // Fallback
  return {
    type: "unknown_error",
    message: String(error),
  };
}

/**
 * Type guard to check if error is a database error.
 */
export function isDbError(error: ServiceError): error is ServiceError & { type: "prisma_error" } {
  return error.type === "prisma_error";
}

/**
 * Type guard for specific database error codes.
 */
export function isDbErrorCode(error: ServiceError, code: string): boolean {
  return error.type === "prisma_error" && error.code === code;
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

/**
 * Generic service response wrapper.
 * Used for consistent API responses across all services.
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    duration?: number;
  };
}

/**
 * Helper to create successful response.
 */
export function successResponse<T>(data: T, durations?: number): ServiceResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(durations && { duration: durations }),
    },
  };
}

/**
 * Helper to create error response.
 */
export function errorResponse(error: ServiceError): ServiceResponse<never> {
  return {
    success: false,
    error: {
      type: error.type,
      message: "message" in error ? error.message : "Unknown error",
      ...(error.type === "validation_error" && {
        details: "details" in error ? error.details : {},
      }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// HONO MIDDLEWARE TYPES
// ============================================================================

/**
 * Standard Variables type for Hono middleware.
 * Extend this type in specific middleware files as needed.
 *
 * Usage in middleware:
 * ```typescript
 * type Env = { Variables: HonoVariables }
 * const app = new Hono<Env>()
 * ```
 */
export type HonoVariables = {
  userId?: string;
  userEmail?: string;
  requestId: string;
  startTime: number;
};

/**
 * Standard Hono Env type combining Bindings and Variables.
 * Use this as base type for all Hono app declarations.
 */
export type HonoEnv = {
  Bindings: {
    DATABASE_URL?: string;
    JWT_SECRET?: string;
  };
  Variables: HonoVariables;
};

// ============================================================================
// QUERY BUILDER TYPES (for Kysely operations)
// ============================================================================

/**
 * Type-safe query filter builder.
 * Replaces patterns like `.where((eb: any) => ...)`
 *
 * This type describes the ExpressionBuilder interface without using `any`.
 */
export interface QueryFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: unknown;
}

/**
 * Helper to build type-safe filters without using `any`.
 */
export function buildFilter(field: string, operator: string, value: unknown): QueryFilter {
  return {
    field,
    operator: operator as QueryFilter["operator"],
    value,
  };
}

// ============================================================================
// BATCH OPERATION TYPES
// ============================================================================

/**
 * Type for batch operations (e.g., createMany).
 * For Zenstack, import the specific *CreateArgs from @finanzas/db
 *
 * Usage:
 * ```typescript
 * import type { RoleCreateArgs } from '@finanzas/db'
 *
 * type RoleCreateData = ExtractCreateData<RoleCreateArgs>
 * const batch: RoleCreateData[] = [...]
 * ```
 */
export type BatchCreateData<T extends { data?: unknown }> = ExtractCreateData<T>[];

/**
 * Type for batch update operations
 */
export type BatchUpdateData<T extends { data?: unknown }> = {
  id: string | number;
  data: ExtractUpdateData<T>;
}[];

/**
 * Batch operation result.
 */
export interface BatchOperationResult {
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    error: ServiceError;
  }>;
}

// ============================================================================
// MAPPING & TRANSFORMATION TYPES
// ============================================================================

/**
 * Generic mapper function type.
 * Replaces patterns like `(data: any) => ...`
 *
 * Usage:
 * ```typescript
 * import type { RoleGetPayload } from '@finanzas/db'
 * import type { RoleDTO } from '@/types'
 *
 * const roleMapper: Mapper<RoleGetPayload<{}>, RoleDTO> = (role) => ({
 *   id: role.id,
 *   name: role.name,
 * })
 * ```
 */
export type Mapper<From, To> = (input: From) => To;

/**
 * Batch mapper type.
 */
export type BatchMapper<From, To> = (inputs: From[]) => To[];

/**
 * Create a batch mapper from a single mapper.
 */
export function createBatchMapper<From, To>(mapper: Mapper<From, To>): BatchMapper<From, To> {
  return (inputs: From[]) => inputs.map(mapper);
}
