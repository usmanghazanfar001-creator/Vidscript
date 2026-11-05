/** Counts failed sign-ins per key (an IP address) inside a time window. Memory only: each server instance keeps its own count. */
export function createLimiter(opts: { max: number; windowMs: number }) {
  const fails = new Map<string, number[]>();
  const recent = (key: string, now: number) => (fails.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  return {
    check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
      const r = recent(key, now);
      if (r.length < opts.max) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.ceil((r[0]! + opts.windowMs - now) / 1000) };
    },
    fail(key: string, now: number = Date.now()) {
      fails.set(key, [...recent(key, now), now]);
      if (fails.size > 1000) fails.delete(fails.keys().next().value as string);
    },
    reset(key: string) { fails.delete(key); },
  };
}
