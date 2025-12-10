export const DEFAULT_MAX_LIMIT = 5000;
export const DEFAULT_DEFAULT_LIMIT = 500;
export const DEFAULT_PREVIEW_LIMIT = 50;
export const DEFAULT_MAX_OFFSET = 50000;

export function clampLimit(value: number | undefined, fallback: number): number {
  const n = value ?? fallback;
  return Math.min(Math.max(n, 1), DEFAULT_MAX_LIMIT);
}

export function clampOffset(value: number | undefined): number {
  const n = value ?? 0;
  return Math.min(Math.max(n, 0), DEFAULT_MAX_OFFSET);
}
