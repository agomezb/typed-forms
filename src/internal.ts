// Protocolo interno entre nodos (campo, formulario, lista). Se usa Symbol.for para que
// dos copias del paquete (npm link, bundles duplicados) sigan reconociéndose entre sí.
export const KIND = Symbol.for('typed-forms/kind');
export const ATTACH = Symbol.for('typed-forms/attach');
export const INVALIDATE = Symbol.for('typed-forms/invalidate');
export const EMIT = Symbol.for('typed-forms/emit');
export const CHILD_CHANGED = Symbol.for('typed-forms/child-changed');
export const BATCH = Symbol.for('typed-forms/batch');

export type Kind = 'field' | 'form' | 'array';

export type Listener = () => void;

/**
 * Lo que devuelve `subscribe`: se puede llamar como función (contrato de React
 * `useSyncExternalStore`) o usar `.unsubscribe()` (contrato `Subscribable` de Angular y RxJS).
 */
export type Unsubscribe = (() => void) & { unsubscribe(): void };

/** Observer al estilo RxJS; es lo que pasa Angular `toSignal()` a `subscribe`. */
export interface StateObserver<T> {
  next?: (value: T) => void;
  error?: (error: unknown) => void;
  complete?: () => void;
}

export function toUnsubscribe(fn: () => void): Unsubscribe {
  const off = (() => fn()) as Unsubscribe;
  off.unsubscribe = off;
  return off;
}

export interface ParentNode {
  readonly submitted: boolean;
  [CHILD_CHANGED](): void;
  [BATCH](fn: () => void): void;
}

export interface ChildNode {
  readonly [KIND]: Kind;
  readonly value: unknown;
  readonly valid: boolean;
  reset(): void;
  [ATTACH](parent: ParentNode | null): void;
  [INVALIDATE](): void;
  [EMIT](): void;
}

export function kindOf(node: unknown): Kind | undefined {
  return node != null && typeof node === 'object' ? (node as { [KIND]?: Kind })[KIND] : undefined;
}

/** Maneja agrupación y notificación para el nodo raíz (formulario o lista sin padre). */
export class RootScheduler {
  static readonly MAX_PASSES = 100;
  #depth = 0;
  #pending = false;
  #flushing = false;

  constructor(private readonly flush: () => void) {}

  changed(): void {
    if (this.#depth > 0 || this.#flushing) {
      // Dentro de un batch o de una notificación en curso: se encola en vez de notificar en recursión.
      this.#pending = true;
    } else {
      this.#run();
    }
  }

  batch(fn: () => void): void {
    this.#depth++;
    try {
      fn();
    } finally {
      this.#depth--;
      if (this.#depth === 0 && this.#pending && !this.#flushing) {
        this.#run();
      }
    }
  }

  #run(): void {
    this.#flushing = true;
    try {
      let passes = 0;
      do {
        if (++passes > RootScheduler.MAX_PASSES) {
          throw new Error('typed-forms: ciclo de actualizaciones (un listener cambia valores en cada notificación)');
        }
        this.#pending = false;
        this.flush();
      } while (this.#pending);
    } finally {
      this.#flushing = false;
      this.#pending = false;
    }
  }
}
