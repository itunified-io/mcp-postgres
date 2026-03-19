import { z } from 'zod';

/** PostgreSQL connection string */
export const ConnectionStringSchema = z
  .string()
  .min(1, 'Connection string is required')
  .refine(
    (s) => s.startsWith('postgresql://') || s.startsWith('postgres://'),
    'Connection string must start with postgresql:// or postgres://',
  );

/** SQL identifier (table, column, schema name) — prevents injection */
export const IdentifierSchema = z
  .string()
  .min(1, 'Identifier is required')
  .max(63, 'Identifier must be 63 characters or less')
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid SQL identifier');

/** Schema name with default */
export const SchemaSchema = IdentifierSchema.default('public');

/** Positive integer for LIMIT */
export const LimitSchema = z.number().int().min(1).max(10000).default(100);

/** Boolean that accepts string "true"/"false" from MCP protocol */
export const CoercedBooleanSchema = z.preprocess((v) => {
  if (typeof v === 'string') return v === 'true';
  return v;
}, z.boolean());

/** Confirm parameter for destructive operations */
export const ConfirmSchema = CoercedBooleanSchema.refine(
  (v) => v === true,
  'This is a destructive operation. Set confirm: true to proceed.',
);
