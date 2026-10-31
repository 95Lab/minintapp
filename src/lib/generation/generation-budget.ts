import "server-only";
import { AppError } from "@/lib/api/app-error-codes";
export class GenerationBudget {
  private count = 0;
  private active = 0;
  private resetAt = 0;
  constructor(private now = Date.now) {}
  acquire(hourly: number, concurrent: number) {
    const now = this.now();
    if (now >= this.resetAt) { this.count = 0; this.resetAt = now + 3_600_000; }
    if (this.count >= hourly || this.active >= concurrent) throw new AppError("rate_limited");
    this.count++; this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}
const state = globalThis as typeof globalThis & { minintGenerationBudget?: GenerationBudget };
export const generationBudget = state.minintGenerationBudget ??= new GenerationBudget();
