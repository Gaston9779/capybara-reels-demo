import type { RoundRecord, SessionState } from "../../../shared/types/game.js";
import { hashForAudit, stableStringify } from "../rng/deterministicRng.js";

export class MemoryRoundStore {
  readonly sessions = new Map<string, SessionState>();
  readonly rounds = new Map<string, RoundRecord>();
  readonly idempotency = new Map<string, { payloadHash: string; response: unknown }>();
  readonly auditLogs: Array<{ eventType: string; checksum: string; payload: unknown; timestamp: string }> = [];

  saveSession(session: SessionState): void {
    this.sessions.set(session.sessionId, structuredClone(session));
  }

  getSession(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  saveRound(round: RoundRecord): void {
    this.rounds.set(round.roundId, structuredClone(round));
  }

  getRound(roundId: string): RoundRecord | null {
    const round = this.rounds.get(roundId);
    return round ? structuredClone(round) : null;
  }

  listRounds(limit = 50): RoundRecord[] {
    return [...this.rounds.values()]
      .slice(-Math.max(1, Math.min(limit, 250)))
      .reverse()
      .map((round) => structuredClone(round));
  }

  getIdempotent<T>(key: string, payload: unknown): T | null {
    const existing = this.idempotency.get(key);
    if (!existing) return null;
    if (existing.payloadHash !== hashForAudit(payload)) throw new Error("IDEMPOTENCY_CONFLICT");
    return structuredClone(existing.response) as T;
  }

  setIdempotent(key: string, payload: unknown, response: unknown): void {
    this.idempotency.set(key, { payloadHash: hashForAudit(payload), response: structuredClone(response) });
  }

  audit(eventType: string, payload: unknown): void {
    this.auditLogs.push({
      eventType,
      checksum: hashForAudit(payload),
      payload: JSON.parse(stableStringify(payload)),
      timestamp: new Date().toISOString()
    });
    if (this.auditLogs.length > 500) this.auditLogs.shift();
  }
}
