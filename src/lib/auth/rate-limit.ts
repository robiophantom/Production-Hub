import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

interface Entry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, Entry>();

/**
 * Small in-process throttle for credential stuffing attempts. Serverless
 * deployments should add an edge/WAF rate limit; this still protects a
 * continuously running Node server.
 */
export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.count < MAX_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0 };
  return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
