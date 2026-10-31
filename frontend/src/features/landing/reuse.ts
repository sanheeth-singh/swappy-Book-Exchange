export const REUSE_MIN = 1;
export const REUSE_MAX = 20;
export function reuseIllustration(exchanges: number) {
 const planned = Math.max(REUSE_MIN, Math.min(REUSE_MAX, Math.round(Number.isFinite(exchanges) ? exchanges : REUSE_MIN)));
 return { exchanges: planned, handovers: planned * 2 };
}
