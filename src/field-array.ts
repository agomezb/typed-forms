import type { FormModel, ValueOf } from './form.js';
import {
  ATTACH, BATCH, CHILD_CHANGED, EMIT, INVALIDATE, KIND, RootScheduler, toUnsubscribe,
  type Listener, type ParentNode, type Unsubscribe,
} from './internal.js';

/** Lista dinámica de subformularios (p. ej. un formulario por pasajero). */
export class FieldArray<F extends FormModel<any>> implements ParentNode {
  readonly [KIND] = 'array' as const;
  readonly #items: F[];
  readonly #listeners = new Set<Listener>();
  readonly #root = new RootScheduler(() => {
    this[INVALIDATE]();
    this[EMIT]();
  });
  #parent: ParentNode | null = null;

  constructor(items: Iterable<F> = []) {
    this.#items = [...items];
    for (const item of this.#items) {
      item[ATTACH](this);
    }
  }

  get items(): ReadonlyArray<F> {
    return this.#items;
  }

  get length(): number {
    return this.#items.length;
  }

  at(index: number): F | undefined {
    return this.#items.at(index);
  }

  get value(): Array<ValueOf<F>> {
    return this.#items.map(item => item.value as ValueOf<F>);
  }

  get valid(): boolean {
    return this.#items.every(item => item.valid);
  }

  get submitted(): boolean {
    return this.#parent?.submitted ?? false;
  }

  push(...items: F[]): void {
    for (const item of items) {
      item[ATTACH](this);
    }
    this.#items.push(...items);
    this[CHILD_CHANGED]();
  }

  removeAt(index: number): void {
    const [removed] = this.#items.splice(index, 1);
    removed?.[ATTACH](null);
    this[CHILD_CHANGED]();
  }

  reset(): void {
    this[BATCH](() => this.#items.forEach(item => item.reset()));
  }

  subscribe = (listener: Listener): Unsubscribe => {
    this.#listeners.add(listener);
    return toUnsubscribe(() => this.#listeners.delete(listener));
  };

  [ATTACH](parent: ParentNode | null): void {
    this.#parent = parent;
  }

  [INVALIDATE](): void {
    this.#items.forEach(item => item[INVALIDATE]());
  }

  [EMIT](): void {
    this.#items.forEach(item => item[EMIT]());
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }

  [CHILD_CHANGED](): void {
    if (this.#parent) {
      this.#parent[CHILD_CHANGED]();
    } else {
      this.#root.changed();
    }
  }

  [BATCH](fn: () => void): void {
    if (this.#parent) {
      this.#parent[BATCH](fn);
    } else {
      this.#root.batch(fn);
    }
  }
}

export function fieldArray<F extends FormModel<any>>(items?: Iterable<F>): FieldArray<F> {
  return new FieldArray(items);
}
