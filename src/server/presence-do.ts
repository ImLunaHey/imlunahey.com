import { DurableObject } from 'cloudflare:workers';

const STALE_MS = 30_000;

/**
 * One DO instance per path (keyed via idFromName(path)). Tracks active
 * session ids → lastSeen ms. All state is in-memory — when the DO hibernates
 * it unloads; first request after wake starts from zero, which is the correct
 * semantics for presence (nothing to persist).
 */
export class PresenceDO extends DurableObject {
  private sessions = new Map<string, number>();

  async beat(sid: string): Promise<number> {
    const now = Date.now();
    this.sessions.set(sid, now);
    for (const [s, t] of this.sessions) {
      if (now - t > STALE_MS) this.sessions.delete(s);
    }
    return this.sessions.size;
  }
}
