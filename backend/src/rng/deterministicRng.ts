const encoder = new TextEncoder();

export interface RngSource {
  next(): number;
  audit: {
    algorithm: "fnv1a-mulberry32-demo";
    serverSeedHash: string;
    nonce: string;
    roundId: string;
    spinIndex: number;
  };
}

export function createDeterministicRng(input: {
  serverSeed: string;
  nonce: string;
  roundId: string;
  spinIndex: number;
}): RngSource {
  let h = fnv1a(`${input.serverSeed}:${input.nonce}:${input.roundId}:${input.spinIndex}`);
  return {
    next() {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    audit: {
      algorithm: "fnv1a-mulberry32-demo",
      serverSeedHash: hashForAudit(input.serverSeed),
      nonce: input.nonce,
      roundId: input.roundId,
      spinIndex: input.spinIndex
    }
  };
}

export function hashForAudit(value: unknown): string {
  return fnv1a(stableStringify(value)).toString(16).padStart(8, "0");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function fnv1a(value: string): number {
  const bytes = encoder.encode(value);
  let h = 2166136261;
  for (const byte of bytes) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
