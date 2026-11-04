/**
 * Drops undefined keys. DTO classes compile with useDefineForClassFields (ES2022+ target), so every
 * declared field exists as an own property; spreading a DTO would otherwise overwrite stored values
 * with undefined. null is kept: it means "clear this field".
 */
export function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
