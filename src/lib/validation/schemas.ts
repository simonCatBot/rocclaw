/**
 * Zod Validation Schemas
 *
 * Input validation schemas for all API operations.
 * Provides type-safe validation with clear error messages.
 */

import { z } from "zod";

// ============================================
// Common Schemas
// ============================================

/**
 * Non-empty string with max length
 */
export const nonEmptyString = (fieldName: string) =>
  z
    .string()
    .min(1, { message: `${fieldName} is required` })
    .transform((val) => val.trim());

/**
 * UUID string
 */
export const uuidString = z
  .string()
  .uuid({ message: "Invalid UUID format" })
  .transform((val) => val.trim());

/**
 * Agent ID (UUID or alphanumeric with dashes)
 */
export const agentIdSchema = z
  .string()
  .min(1, { message: "Agent ID is required" })
  .max(128, { message: "Agent ID is too long" })
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    { message: "Agent ID must contain only letters, numbers, underscores, and hyphens" }
  )
  .transform((val) => val.trim());

/**
 * Session key for chat operations
 */
export const sessionKeySchema = z
  .string()
  .min(1, { message: "Session key is required" })
  .max(256, { message: "Session key is too long" })
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    { message: "Session key must contain only letters, numbers, underscores, and hyphens" }
  )
  .transform((val) => val.trim());

// ============================================
// Agent Operations
// ============================================

/**
 * Agent name validation
 * - 1-64 characters
 * - No special characters that could cause path issues
 */
export const agentNameSchema = z
  .string()
  .min(1, { message: "Agent name is required" })
  .max(64, { message: "Agent name must be 64 characters or less" })
  .regex(
    /^[a-zA-Z0-9\s._-]+$/,
    { message: "Agent name must contain only letters, numbers, spaces, dots, underscores, and hyphens" }
  )
  .transform((val) => val.trim());

/**
 * Agent slug (derived from name, used for file paths)
 * - 1-64 characters
 * - Only lowercase alphanumeric, hyphens, underscores
 */
export const agentSlugSchema = z
  .string()
  .min(1, { message: "Agent slug is required" })
  .max(64, { message: "Agent slug must be 64 characters or less" })
  .regex(
    /^[a-z0-9_-]+$/,
    { message: "Agent slug must contain only lowercase letters, numbers, underscores, and hyphens" }
  );

/**
 * Schema for agent creation
 */
export const agentCreateSchema = z.object({
  name: agentNameSchema,
});

/**
 * Schema for agent rename
 */
export const agentRenameSchema = z.object({
  agentId: agentIdSchema,
  newName: agentNameSchema,
});

/**
 * Schema for agent deletion
 */
export const agentDeleteSchema = z.object({
  agentId: agentIdSchema,
});

// ============================================
// Chat Operations
// ============================================

/**
 * Chat message validation
 * - 1-10000 characters
 * - Strips leading/trailing whitespace
 */
export const chatMessageSchema = z
  .string()
  .min(1, { message: "Message cannot be empty" })
  .max(10000, { message: "Message must be 10000 characters or less" })
  .transform((val) => val.trim());

/**
 * Schema for chat send
 */
export const chatSendSchema = z.object({
  sessionKey: sessionKeySchema,
  message: chatMessageSchema,
  idempotencyKey: z
    .string()
    .min(1, { message: "Idempotency key is required" })
    .max(256, { message: "Idempotency key is too long" }),
  deliver: z.boolean().default(true),
});

/**
 * Schema for chat abort
 */
export const chatAbortSchema = z.object({
  sessionKey: sessionKeySchema,
});

// ============================================
// Session Settings
// ============================================

/**
 * Available model options
 */
export const modelSchema = z.enum([
  "gpt-4",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-opus",
  "claude-3-sonnet",
  "claude-3-haiku",
]);

/**
 * Thinking level options
 */
export const thinkingLevelSchema = z.enum(["off", "low", "medium", "high"]);

/**
 * Execution host options
 */
export const execHostSchema = z.enum([
  "local",
  "remote",
  "sandbox",
  "gateway",
]);

/**
 * Execution security levels
 */
export const execSecuritySchema = z.enum([
  "strict",
  "normal",
  "permissive",
]);

/**
 * Schema for session settings sync
 */
export const sessionSettingsSchema = z.object({
  sessionKey: sessionKeySchema,
  settings: z.object({
    model: modelSchema.optional(),
    thinkingLevel: thinkingLevelSchema.optional(),
    execHost: execHostSchema.optional(),
    execSecurity: execSecuritySchema.optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().max(32000).optional(),
    topP: z.number().min(0).max(1).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
  }),
});

// ============================================
// Cron Operations
// ============================================

/**
 * Cron expression validation
 * - Standard 5-field cron: minute hour day month weekday
 * - 6-field cron with seconds: second minute hour day month weekday
 * - Supports special strings: @yearly, @monthly, @weekly, @daily, @hourly
 */
const standardCronRegex =
  /^([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)$/;
const extendedCronRegex =
  /^([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)\s+([\*\/0-9,-]+)$/;
const specialCronRegex = /^@(yearly|monthly|weekly|daily|hourly|reboot)$/;

export const cronExpressionSchema = z
  .string()
  .min(1, { message: "Cron expression is required" })
  .max(128, { message: "Cron expression is too long" })
  .refine(
    (val) =>
      standardCronRegex.test(val) ||
      extendedCronRegex.test(val) ||
      specialCronRegex.test(val),
    {
      message:
        "Invalid cron expression. Use standard 5-field cron, 6-field with seconds, or special strings like @hourly",
    }
  )
  .transform((val) => val.trim());

/**
 * Schema for cron add
 */
export const cronAddSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Cron job name is required" })
    .max(64, { message: "Cron job name must be 64 characters or less" })
    .regex(
      /^[a-zA-Z0-9\s_-]+$/,
      { message: "Cron job name must contain only letters, numbers, spaces, underscores, and hyphens" }
    )
    .transform((val) => val.trim()),
  agentId: agentIdSchema,
  schedule: cronExpressionSchema,
  intent: z
    .string()
    .min(1, { message: "Intent is required" })
    .max(256, { message: "Intent must be 256 characters or less" })
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      { message: "Intent must contain only letters, numbers, dots, underscores, and hyphens" }
    ),
  params: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

/**
 * Schema for cron remove
 */
export const cronRemoveSchema = z.object({
  name: z.string()
    .min(1, { message: "Cron job name is required" })
    .max(64, { message: "Cron job name must be 64 characters or less" })
    .transform((val) => val.trim()),
});

/**
 * Schema for cron remove agent
 */
export const cronRemoveAgentSchema = z.object({
  agentId: agentIdSchema,
});

/**
 * Schema for cron run (manual trigger)
 */
export const cronRunSchema = z.object({
  name: z.string().min(1).max(64).transform((val) => val.trim()),
});

// ============================================
// File Operations
// ============================================

/**
 * Schema for agent file set
 */
export const agentFileSetSchema = z.object({
  agentId: agentIdSchema,
  path: z
    .string()
    .min(1, { message: "File path is required" })
    .max(512, { message: "File path is too long" })
    .regex(
      /^[a-zA-Z0-9_\/.-]+$/,
      { message: "File path must contain only letters, numbers, underscores, forward slashes, dots, and hyphens" }
    )
    .refine((val) => !val.includes(".."), {
      message: "File path cannot contain parent directory references",
    })
    .transform((val) => val.trim()),
  content: z.string().max(5_000_000, { message: "File content must be 5MB or less" }),
});

// ============================================
// Permission Operations
// ============================================

/**
 * Schema for agent permissions update
 */
export const agentPermissionsSchema = z.object({
  agentId: agentIdSchema,
  permissions: z.object({
    canExecuteTools: z.boolean().optional(),
    canReadFiles: z.boolean().optional(),
    canWriteFiles: z.boolean().optional(),
    canAccessNetwork: z.boolean().optional(),
    canAccessEnvironment: z.boolean().optional(),
    maxExecutionTime: z.number().int().positive().max(3600).optional(),
    allowedTools: z.array(z.string()).optional(),
    blockedTools: z.array(z.string()).optional(),
  }),
});

// ============================================
// Execution Approval
// ============================================

/**
 * Schema for execution approval resolve
 */
export const execApprovalResolveSchema = z.object({
  approvalId: uuidString,
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

// ============================================
// Studio/Gateway Settings
// ============================================

/**
 * Schema for gateway URL
 */
export const gatewayUrlSchema = z
  .string()
  .min(1, { message: "Gateway URL is required" })
  .max(2048, { message: "Gateway URL is too long" })
  .regex(
    /^(ws|wss|http|https):\/\/.+/,
    { message: "Gateway URL must be a valid WebSocket or HTTP URL" }
  )
  .transform((val) => val.trim());

/**
 * Schema for gateway token
 */
export const gatewayTokenSchema = z
  .string()
  .min(1, { message: "Gateway token is required" })
  .max(4096, { message: "Gateway token is too long" })
  .transform((val) => val.trim());

/**
 * Schema for studio settings update
 */
export const studioSettingsSchema = z.object({
  gateway: z
    .object({
      url: gatewayUrlSchema,
      token: gatewayTokenSchema.optional(),
    })
    .optional(),
});

/**
 * Schema for test connection
 */
export const testConnectionSchema = z.object({
  gateway: z.object({
    url: gatewayUrlSchema,
    token: gatewayTokenSchema.optional(),
  }),
  useStoredToken: z.boolean().default(false),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Validate data against a schema and return a standardized error response
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; error: string; issues: z.ZodIssue[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessage = result.error.issues.map((e) => e.message).join("; ");
  return {
    success: false,
    error: errorMessage,
    issues: result.error.issues,
  };
}

/**
 * Create a NextResponse for validation errors
 */
export function createValidationErrorResponse(
  error: string,
  issues?: z.ZodIssue[]
) {
  const details =
    issues?.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })) || [];

  return {
    error: "Validation failed",
    message: error,
    details,
    code: "VALIDATION_ERROR",
  };
}

// Export type inference helpers
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
export type SessionSettingsInput = z.infer<typeof sessionSettingsSchema>;
export type CronAddInput = z.infer<typeof cronAddSchema>;
export type StudioSettingsInput = z.infer<typeof studioSettingsSchema>;
