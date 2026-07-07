/**
 * Shared utility functions
 */

/** Convert snake_case object keys to camelCase */
export function toCamelCase<T extends object>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => (char as string).toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

/** Convert an array of snake_case rows to camelCase */
export function rowsToCamelCase<T extends object>(rows: T[]): Record<string, unknown>[] {
  return rows.map(toCamelCase);
}
