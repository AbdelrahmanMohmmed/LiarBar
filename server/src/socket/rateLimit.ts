/**
 * Small fixed-window rate limiter keyed by an arbitrary string
 * (typically `${socketId}:${event}`). Protects against event spam
 * without any external dependency.
 */
export class RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  /** Returns true if the call is allowed, false if over the limit. */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const win = this.windows.get(key);
    if (!win || now >= win.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    win.count++;
    return win.count <= limit;
  }

  /** Drop all windows belonging to a socket (call on disconnect). */
  clearPrefix(prefix: string): void {
    for (const key of this.windows.keys()) {
      if (key.startsWith(prefix)) this.windows.delete(key);
    }
  }
}
