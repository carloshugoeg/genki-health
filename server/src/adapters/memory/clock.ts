import type { ClockPort } from '../../ports/index.js';

export class SystemClock implements ClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}
