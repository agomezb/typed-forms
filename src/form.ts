import type { Field } from './field.js';
import type { FieldArray } from './field-array.js';
import {
  ATTACH, BATCH, CHILD_CHANGED, EMIT, INVALIDATE, KIND, RootScheduler, kindOf, toUnsubscribe,
  type ChildNode, type Listener, type ParentNode, type StateObserver, type Unsubscribe,
} from './internal.js';
import { getConfig, messageFor, type MessageMap, type ShowErrorsWhen } from './config.js';
import type { ValidationErrors } from './validators.js';

type AnyNode = Field<any> | FormModel<any> | FieldArray<any>;

export type ValueOf<N> =
  N extends Field<infer V> ? V :
  N extends FieldArray<infer F> ? Array<ValueOf<F>> :
  N extends FormModel<infer S> ? FormValue<S> :
  never;

// Se excluyen los miembros de la base: `value` es a su vez un FormValue y crearía recursión.
type OwnKeys<F> = Exclude<keyof F, keyof FormModel<any>>;

/** Valor tipado de un formulario: solo las propiedades que son campos, subformularios o listas. */
export type FormValue<F> = { [K in OwnKeys<F> as F[K] extends AnyNode ? K : never]: ValueOf<F[K]> };

/** Nombres de las propiedades que son campos (`Field`). */
export type FieldName<F> = keyof { [K in OwnKeys<F> as F[K] extends Field<any> ? K : never]: 0 } & string;

export interface FormOptions {
  showErrorsWhen?: ShowErrorsWhen;
  messages?: MessageMap;
}

export interface FormState<F> {
  readonly value: FormValue<F>;
  readonly valid: boolean;
  readonly submitted: boolean;
  readonly submitting: boolean;
  readonly errors: Readonly<Partial<Record<FieldName<F>, ValidationErrors>>>;
}

export type SubmitResult<R> = { ok: true; result: R } | { ok: false; reason: 'invalid' | 'busy' };

/**
 * Base de los formularios. Las propiedades de la subclase que sean `field()`, otro `FormModel`
 * o `fieldArray()` se registran solas la primera vez que se usa el formulario; no hace falta
 * llamar a ningún `initialize()`.
 *
 * `Self` es la propia subclase (`class ViajeForm extends FormModel<ViajeForm>`): permite tipar
 * `value`, `patch` y los nombres de campo también dentro de los métodos de la clase.
 */
export abstract class FormModel<Self = any> implements ParentNode {
  readonly [KIND] = 'form' as const;
  readonly #options: FormOptions;
  readonly #root = new RootScheduler(() => {
    this[INVALIDATE]();
    this[EMIT]();
  });
  readonly #listeners = new Set<Listener>();
  #parent: ParentNode | null = null;
  #children: Array<readonly [string, ChildNode]> | null = null;
  #scannedKeys = -1;
  #submitted = false;
  #submitting = false;
  #state: FormState<Self> | null = null;

  constructor(options: FormOptions = {}) {
    this.#options = options;
  }

  /** Campos, subformularios y listas registrados, en orden de declaración. */
  children(): ReadonlyArray<readonly [string, ChildNode]> {
    const keys = Object.keys(this);
    if (this.#children === null || keys.length !== this.#scannedKeys) {
      const found: Array<readonly [string, ChildNode]> = [];
      for (const key of keys) {
        const node = (this as any)[key] as ChildNode;
        if (kindOf(node)) {
          node[ATTACH](this);
          node[INVALIDATE]();
          found.push([key, node]);
        }
      }
      this.#children = found;
      this.#scannedKeys = keys.length;
    }
    return this.#children;
  }

  get value(): FormValue<Self> {
    const out: Record<string, unknown> = {};
    for (const [name, node] of this.children()) {
      out[name] = node.value;
    }
    return out as FormValue<Self>;
  }

  get valid(): boolean {
    return this.children().every(([, node]) => node.valid);
  }

  get invalid(): boolean {
    return !this.valid;
  }

  get submitted(): boolean {
    return this.#parent ? this.#parent.submitted : this.#submitted;
  }

  get submitting(): boolean {
    return this.#submitting;
  }

  /** Asigna varios valores a la vez (una sola notificación). Las claves `undefined` se ignoran. */
  patch(values: Partial<FormValue<Self>>): void {
    this.batch(() => {
      for (const [name, node] of this.children()) {
        const value = (values as Record<string, unknown>)[name];
        if (value === undefined) {
          continue;
        }
        if (kindOf(node) === 'field') {
          (node as Field<unknown>).setValue(value);
        } else if (kindOf(node) === 'form') {
          (node as FormModel<any>).patch(value as object);
        }
      }
    });
  }

  /** ¿Se debe mostrar el error de este campo según la política (`showErrorsWhen`)? */
  showError(target: FieldName<Self> | Field<any>): boolean {
    const f = this.#field(target);
    if (!f || f.valid) {
      return false;
    }
    switch (this.#options.showErrorsWhen ?? getConfig().showErrorsWhen) {
      case 'always':
        return true;
      case 'touched':
        return f.touched || this.submitted;
      case 'dirty':
        return f.dirty || this.submitted;
      default:
        return this.submitted;
    }
  }

  /** Mensaje del primer error del campo, o `null` si no tiene errores. */
  errorMessage(target: FieldName<Self> | Field<any>): string | null {
    const errors = this.#field(target)?.errors;
    return errors ? messageFor(errors, this.#options.messages) : null;
  }

  /**
   * Marca el formulario como enviado y, si es válido, ejecuta `handler`.
   * Mientras corre, `submitting` es true y un segundo envío se rechaza con `reason: 'busy'`.
   */
  async submit<R>(handler: (value: FormValue<Self>) => R | Promise<R>): Promise<SubmitResult<R>> {
    if (this.#submitting) {
      return { ok: false, reason: 'busy' };
    }
    this.setSubmitted(true);
    if (!this.valid) {
      return { ok: false, reason: 'invalid' };
    }
    this.#submitting = true;
    this[CHILD_CHANGED]();
    try {
      return { ok: true, result: await handler(this.value) };
    } finally {
      this.#submitting = false;
      this[CHILD_CHANGED]();
    }
  }

  setSubmitted(submitted: boolean): void {
    if (this.#submitted !== submitted) {
      this.#submitted = submitted;
      this[CHILD_CHANGED]();
    }
  }

  reset(): void {
    this.batch(() => {
      for (const [, node] of this.children()) {
        node.reset();
      }
      this.setSubmitted(false);
    });
  }

  /** Agrupa varios cambios en una sola notificación. */
  batch(fn: () => void): void {
    this[BATCH](fn);
  }

  /**
   * Avisa de cada cambio. Acepta los dos contratos sin adaptadores:
   * - función (React): `useSyncExternalStore(form.subscribe, form.getState)`
   * - observer (Angular/RxJS): `toSignal(form, { requireSync: true })`; recibe el estado
   *   actual de inmediato, como un BehaviorSubject.
   */
  subscribe = (listener: Listener | StateObserver<FormState<Self>>): Unsubscribe => {
    this.children();
    const notify: Listener = typeof listener === 'function' ? listener : () => listener.next?.(this.getState());
    this.#listeners.add(notify);
    if (typeof listener !== 'function') {
      notify();
    }
    return toUnsubscribe(() => this.#listeners.delete(notify));
  };

  /** Foto inmutable del estado; mantiene la misma referencia hasta el siguiente cambio. */
  getState = (): FormState<Self> => {
    if (!this.#state) {
      const errors: Record<string, ValidationErrors> = {};
      for (const [name, node] of this.children()) {
        const e = kindOf(node) === 'field' ? (node as Field<unknown>).errors : null;
        if (e) {
          errors[name] = e;
        }
      }
      this.#state = Object.freeze({
        value: this.value,
        valid: this.valid,
        submitted: this.submitted,
        submitting: this.#submitting,
        errors: Object.freeze(errors) as FormState<Self>['errors'],
      });
    }
    return this.#state;
  };

  [ATTACH](parent: ParentNode | null): void {
    this.#parent = parent;
  }

  [INVALIDATE](): void {
    for (const [, node] of this.children()) {
      node[INVALIDATE]();
    }
  }

  [EMIT](): void {
    this.#state = null;
    for (const [, node] of this.children()) {
      node[EMIT]();
    }
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

  #field(target: string | Field<any>): Field<any> | undefined {
    const node = typeof target === 'string' ? (this as any)[target] : target;
    return kindOf(node) === 'field' ? node : undefined;
  }
}

class InlineForm<C> extends FormModel<C> {}

/** Variante funcional: `createForm({ usuario: field(''), clave: field('') })`. */
export function createForm<C extends Record<string, AnyNode>>(nodes: C, options?: FormOptions): FormModel<C> & C {
  return Object.assign(new InlineForm<C>(options), nodes);
}
