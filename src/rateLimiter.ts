// Simple leaky bucket placeholder; replace with a robust token bucket when wiring real traffic.
export class RateLimiter {
  private allowance: number;
  private lastCheck: number;

  constructor(private ratePerHour: number) {
    this.allowance = ratePerHour;
    this.lastCheck = Date.now();
  }

  allow(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastCheck;
    const perMs = this.ratePerHour / (60 * 60 * 1000);
    this.allowance = Math.min(this.ratePerHour, this.allowance + elapsed * perMs);
    this.lastCheck = now;
    if (this.allowance < 1) return false;
    this.allowance -= 1;
    return true;
  }
}
