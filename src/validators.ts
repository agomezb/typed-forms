export interface ValidationErrors {
  [code: string]: any;
}

export type Validator<T = any> = (value: T) => ValidationErrors | null;

export function isEmpty(value: unknown): boolean {
  return value == null || (typeof (value as any).length === 'number' && (value as any).length === 0);
}

/** @internal */
export function runValidators<T>(validators: ReadonlyArray<Validator<T>>, value: T): ValidationErrors | null {
  let errors: ValidationErrors | null = null;
  for (const validator of validators) {
    const result = validator(value);
    if (result) {
      errors = { ...(errors ?? {}), ...result };
    }
  }
  return errors;
}

export const required: Validator = value => (isEmpty(value) ? { required: true } : null);

export function minLength(length: number): Validator {
  return value =>
    isEmpty(value) || (value as any).length >= length
      ? null
      : { minlength: { requiredLength: length, actualLength: (value as any).length } };
}

export function maxLength(length: number): Validator {
  return value =>
    value != null && (value as any).length > length
      ? { maxlength: { requiredLength: length, actualLength: (value as any).length } }
      : null;
}

export function pattern(regex: RegExp | string): Validator {
  const re = typeof regex === 'string' ? new RegExp(`^${regex}$`) : regex;
  return value =>
    isEmpty(value) || re.test(String(value)) ? null : { pattern: { requiredPattern: String(re), actualValue: value } };
}

export function min(minimum: number): Validator {
  return value => {
    const n = parseFloat(value);
    return !isEmpty(value) && !isNaN(n) && n < minimum ? { min: { min: minimum, actual: value } } : null;
  };
}

export function max(maximum: number): Validator {
  return value => {
    const n = parseFloat(value);
    return !isEmpty(value) && !isNaN(n) && n > maximum ? { max: { max: maximum, actual: value } } : null;
  };
}

const EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const email: Validator = value => (isEmpty(value) || EMAIL.test(value) ? null : { email: true });

/** Crea un validador desde un predicado: si `test` devuelve false, el error es `{ [code]: true }`. */
export function rule<T = any>(code: string, test: (value: T) => boolean): Validator<T> {
  return value => (test(value) ? null : { [code]: true });
}

/**
 * Aplica los validadores solo mientras `condition()` sea verdadera. La condición se evalúa
 * en cada validación, así que puede leer otros campos del formulario.
 */
export function when<T>(condition: () => boolean, ...validators: Array<Validator<T>>): Validator<T> {
  return value => (condition() ? runValidators(validators, value) : null);
}
