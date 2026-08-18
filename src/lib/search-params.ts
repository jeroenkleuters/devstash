/**
 * A repeated query parameter arrives as an array; every read in the app wants
 * one value, so collapse it here rather than at each call site.
 */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
