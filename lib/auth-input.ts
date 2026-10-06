import { z } from 'zod'
export const roleSchema = z.enum(['admin', 'teacher', 'smt', 'admin-teacher', 'monitor-guardian'])
export const usernameSchema = z.string().trim().toLowerCase().min(1).max(100).regex(/^[a-z0-9._-]+$/, 'Use letters, numbers, dots, underscores or hyphens for usernames')
export const nameSchema = z.string().trim().min(1).max(200)
export const passwordSchema = z.string().min(8).max(128)
