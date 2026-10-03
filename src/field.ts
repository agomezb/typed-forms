import {
  ATTACH, EMIT, INVALIDATE, KIND, CHILD_CHANGED, toUnsubscribe,
  type Listener, type ParentNode, type Unsubscribe,
} from './internal.js';
import { runValidators, type ValidationErrors, type Validator } from './validators.js';

export interface FieldOptions {
  disabled?: boolean;
}

type Validators<T> = Validator<T> | ReadonlyArray<Validator<T>>;

const toArray = <T>(v: Validators<T> | undefined): ReadonlyArray<Validator<T>> =>
  v === undefined ? [] : typeof v === 'function' ? [v] : v;

export class Field<T> {
  readonly [KIND] = 'field' as const;
  readonly #initial: T;
  #value: T;
  #validators: ReadonlyArray<Validator<T>>;
  #errors: ValidationErrors | null = null;
  #stale = true;
  #disabled: boolean;
  #touched = false;
  #dirty = false;
  #parent: ParentNode | null = null;
  readonly #listeners = new Set<Listener>();

  constructor(initial: T, validators?: Validators<NoInfer<T>>, options: FieldOptions = {}) {
    this.#initial = initial;
    this.#value = initial;
    this.#validators = toArray(validators);
    this.#disabled = options.disabled ?? false;
    // Enlazados para poder pasarlos tal cual: onChange={...} / onBlur={field.markTouched}
    this.setValue = this.setValue.bind(this);
    this.markTouched = this.markTouched.bind(this);
  }

  get value(): T {
    return this.#value;
  }

  /** Errores actuales. Se calculan al leerlos, así los validadores ven siempre el estado vigente del formulario. */
  get errors(): ValidationErrors | null {
    if (this.#disabled) {
      return null;
    }
    if (this.#stale) {
      this.#errors = runValidators(this.#validators, this.#value);
      this.#stale = false;
    }
    return this.#errors;
  }

  get valid(): boolean {
    return this.errors === null;
  }

  get invalid(): boolean {
    return !this.valid;
  }

  get disabled(): boolean {
    return this.#disabled;
  }

  get touched(): boolean {
    return this.#touched;
  }

  get dirty(): boolean {
    return this.#dirty;
  }

  setValue(value: T): void {
    if (Object.is(value, this.#value)) {
      return;
    }
    this.#value = value;
    this.#dirty = true;
    this.#changed();
  }

  reset(value: T = this.#initial): void {
    this.#value = value;
    this.#dirty = false;
    this.#touched = false;
    this.#changed();
  }

  markTouched(): void {
    if (!this.#touched) {
      this.#touched = true;
      this.#changed();
    }
  }

  enable(): void {
    if (this.#disabled) {
      this.#disabled = false;
      this.#changed();
    }
  }

  disable(): void {
    if (!this.#disabled) {
      this.#disabled = true;
      this.#changed();
    }
  }

  setValidators(validators?: Validators<T>): void {
    this.#validators = toArray(validators);
    this.#changed();
  }

  subscribe = (listener: Listener): Unsubscribe => {
    this.#listeners.add(listener);
    return toUnsubscribe(() => this.#listeners.delete(listener));
  };

  [ATTACH](parent: ParentNode | null): void {
    this.#parent = parent;
  }

  [INVALIDATE](): void {
    this.#stale = true;
  }

  [EMIT](): void {
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }

  #changed(): void {
    if (this.#parent) {
      this.#parent[CHILD_CHANGED]();
    } else {
      this[INVALIDATE]();
      this[EMIT]();
    }
  }
}

/** `T` se infiere solo del valor inicial (NoInfer evita que los validadores lo vuelvan literal). */
export function field<T>(initial: T, validators?: Validators<NoInfer<T>>, options?: FieldOptions): Field<T> {
  return new Field(initial, validators, options);
}
