import { z } from 'zod';

// Strip null bytes and control characters
function sanitizeString(str: string): string {
  return str
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

export function sanitizeInput(input: string, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  const sanitized = sanitizeString(input);
  return sanitized.slice(0, maxLength);
}

export function sanitizeEmail(email: string): string {
  return sanitizeInput(email, 254).toLowerCase();
}

export function sanitizeUsername(username: string): string {
  return sanitizeInput(username, 50).replace(/[^a-zA-Z0-9._-]/g, '');
}

// Common validation schemas
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254)
  .transform(sanitizeEmail);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username is too long')
  .transform(sanitizeUsername);

export const titleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(200)
  .transform((s) => sanitizeInput(s, 200));

export const notesSchema = z
  .string()
  .max(5000)
  .optional()
  .transform((s) => (s ? sanitizeInput(s, 5000) : undefined));

export const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

export const registrationSchema = z.object({
  firstName: z.string().min(1).max(50).transform((s) => sanitizeInput(s, 50)),
  lastName: z.string().min(1).max(50).transform((s) => sanitizeInput(s, 50)),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().max(254),
  password: z.string().max(128),
});

export const passwordEntrySchema = z
  .object({
    title: titleSchema,
    username: z.string().max(200).optional(),
    password: z.string().min(1).max(5000).optional(),
    /** Pre-sealed USER_MASTER ciphertext from the browser */
    encryptedPassword: z.string().min(1).optional(),
    encryptedNotes: z.string().optional(),
    clientEncrypted: z.boolean().optional(),
    strength: z.number().int().min(0).max(100).optional(),
    website: z.string().url().max(2000).optional().or(z.literal('')),
    category: z.string().max(100).optional(),
    notes: notesSchema,
    tags: z.string().max(500).optional(),
    expiryDate: z.string().optional(),
    icon: z.string().max(100).optional(),
    color: z.string().max(7).optional(),
    label: z.string().max(100).optional(),
    isGlobal: z.boolean().optional(),
    isTeam: z.boolean().optional(),
    teamId: z.string().optional(),
    serviceId: z.union([z.string().cuid(), z.literal(''), z.null()]).optional(),
    encryptionType: z.enum(['PUBLIC_KEY', 'USER_MASTER', 'ORG_KEY']).optional(),
  })
  .refine(
    (d) => (d.clientEncrypted ? !!d.encryptedPassword : !!d.password),
    { message: 'password or encryptedPassword required', path: ['password'] }
  );

export const passwordEntryUpdateSchema = z.object({
  title: titleSchema.optional(),
  username: z.string().max(200).optional(),
  password: z.string().min(1).max(5000).optional(),
  encryptedPassword: z.string().min(1).optional(),
  encryptedNotes: z.string().optional(),
  clientEncrypted: z.boolean().optional(),
  strength: z.number().int().min(0).max(100).optional(),
  website: z.string().url().max(2000).optional().or(z.literal('')),
  category: z.string().max(100).optional(),
  notes: notesSchema,
  tags: z.string().max(500).optional(),
  expiryDate: z.string().nullable().optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(7).optional(),
  label: z.string().max(100).optional(),
  isGlobal: z.boolean().optional(),
  serviceId: z.union([z.string().cuid(), z.literal(''), z.null()]).optional(),
});

export const PROBE_TYPES = [
  'sqlserver',
  'postgres',
  'http_basic',
  'http_bearer',
  'http_header',
] as const;

export type ProbeType = (typeof PROBE_TYPES)[number];

/** Non-executable connection profile — never treated as code/driver. */
export const connectionProfileSchema = z
  .object({
    type: z.enum(PROBE_TYPES),
    host: z.string().max(255).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    database: z.string().max(200).optional(),
    username: z.string().max(500).optional(),
    password: z.string().max(5000).optional(),
    url: z.string().url().max(2000).optional(),
    headerName: z.string().max(100).optional(),
    ssl: z.boolean().optional(),
    encrypt: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.type === 'sqlserver' || d.type === 'postgres') {
      if (!d.host) ctx.addIssue({ code: 'custom', message: 'host required', path: ['host'] });
      if (!d.database) ctx.addIssue({ code: 'custom', message: 'database required', path: ['database'] });
    }
    if (d.type.startsWith('http_') && !d.url) {
      ctx.addIssue({ code: 'custom', message: 'url required', path: ['url'] });
    }
    if (d.type === 'http_header' && !d.headerName) {
      ctx.addIssue({ code: 'custom', message: 'headerName required', path: ['headerName'] });
    }
  });

export const serviceProbeFieldsSchema = z.object({
  probeType: z.enum(PROBE_TYPES).optional().nullable(),
  probeUrl: z.string().url().max(2000).optional().nullable().or(z.literal('')),
  probeAuth: z.string().max(100).optional().nullable(),
});
