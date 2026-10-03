import { useId, type InputHTMLAttributes } from 'react';
import type { Field, FormModel } from 'typed-forms';

// Componentes de presentación reutilizables. Reciben el formulario (para saber si mostrar el
// error según su política) y el campo tipado; no guardan estado propio.

interface FieldProps<T> {
  form: FormModel;
  field: Field<T>;
  label: string;
}

export function FieldError({ form, field, id }: { form: FormModel; field: Field<any>; id?: string }) {
  return form.showError(field) ? <small id={id} className="error">{form.errorMessage(field)}</small> : null;
}

type TextFieldProps = FieldProps<string> &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'form' | 'value' | 'onChange' | 'onBlur'>;

export function TextField({ form, field, label, ...inputProps }: TextFieldProps) {
  const id = useId();
  const invalid = form.showError(field);
  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...inputProps}
        value={field.value}
        disabled={field.disabled}
        onChange={e => field.setValue(e.target.value)}
        onBlur={field.markTouched}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      <FieldError form={form} field={field} id={`${id}-error`} />
    </div>
  );
}

export function CheckboxField({ form, field, label, onChange = field.setValue }: FieldProps<boolean> & {
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="campo campo-check">
      <label>
        <input
          type="checkbox"
          checked={field.value}
          disabled={field.disabled}
          onChange={e => onChange(e.target.checked)}
          onBlur={field.markTouched}
        />
        {label}
      </label>
      <FieldError form={form} field={field} />
    </div>
  );
}

export function SelectField({ form, field, label, options }: FieldProps<string> & { options: readonly string[] }) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={field.value}
        disabled={field.disabled}
        onChange={e => field.setValue(e.target.value)}
        onBlur={field.markTouched}
        aria-invalid={form.showError(field)}
      >
        <option value="">Seleccione…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <FieldError form={form} field={field} />
    </div>
  );
}

/** Muestra la foto inmutable de `form.getState()`; útil para ver qué pasa por dentro. */
export function StateViewer({ form }: { form: FormModel }) {
  return (
    <details className="estado">
      <summary>Estado del formulario</summary>
      <pre>{JSON.stringify(form.getState(), null, 2)}</pre>
    </details>
  );
}
