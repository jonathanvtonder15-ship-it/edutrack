import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SessionClaims { userId: string; expiresAt: number }

export function signSession(claims: SessionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
}

export function verifySession(token: string, secret: string, now = Date.now()): SessionClaims | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [payload, signature] = parts
    const expected = createHmac('sha256', secret).update(payload).digest()
    const actual = Buffer.from(signature, 'base64url')
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!claims || typeof claims !== 'object' || !('userId' in claims) || !('expiresAt' in claims)) return null
    if (typeof claims.userId !== 'string' || !claims.userId || typeof claims.expiresAt !== 'number' || claims.expiresAt <= now) return null
    return { userId: claims.userId, expiresAt: claims.expiresAt }
  } catch { return null }
}
