// Deterministic helpers: everything in the life layer derives from a seed.

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hash(...parts: (number | string)[]): number {
  return hashStr(parts.join("|"));
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof mulberry32>;

export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const range = (r: Rng, a: number, b: number) => a + r() * (b - a);
export const irange = (r: Rng, a: number, b: number) => Math.floor(range(r, a, b + 1));

/** hash-based uniform in [0,1) */
export const u = (...parts: (number | string)[]) => (hash(...parts) % 1_000_000) / 1_000_000;
