// Browser-only replacement for the two node:crypto exports used by Groups.
export const randomUUID = () => crypto.randomUUID();
export function randomInt(min: number, max?: number): number {
  if (max === undefined) { max = min; min = 0; }
  const range = max - min;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || range <= 0 || range > 0x1_0000_0000) throw new Error('INVALID_RANDOM_RANGE');
  const limit = Math.floor(0x1_0000_0000 / range) * range;
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0]! >= limit);
  return min + values[0]! % range;
}
