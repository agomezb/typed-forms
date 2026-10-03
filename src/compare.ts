export interface Identifiable {
  id?: unknown;
}

/** Comparador por `id` para selects con objetos (`compareWith` en Angular, etc.). */
export function compareById(a: Identifiable | null | undefined, b: Identifiable | null | undefined): boolean {
  return a && b ? a.id === b.id : a === b;
}
