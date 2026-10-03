import { useState, type FormEvent } from 'react';
import * as api from '../api';
import { CheckboxField, StateViewer, TextField } from '../components/fields';
import { RegistroForm } from '../forms/registro-form';
import { useForm } from '../use-form';

export function RegistroExample() {
  const form = useForm(() => new RegistroForm());
  const [registrado, setRegistrado] = useState<RegistroForm['value'] | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await form.submit(api.registrar);
    if (r.ok) {
      setRegistrado(r.result);
    }
  }

  function limpiar() {
    form.reset();
    setRegistrado(null);
  }

  if (registrado) {
    return (
      <div className="resultado">
        <p className="aviso">Cuenta creada para <strong>{registrado.correo}</strong>.</p>
        <button type="button" onClick={limpiar}>Registrar otra</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <TextField form={form} field={form.nombre} label="Nombre" autoComplete="name" />
      <TextField form={form} field={form.correo} label="Correo" type="email" autoComplete="email" />
      <div className="fila">
        <TextField form={form} field={form.clave} label="Clave" type="password" autoComplete="new-password" />
        <TextField form={form} field={form.confirmacion} label="Confirmar clave" type="password" autoComplete="new-password" />
      </div>

      <CheckboxField form={form} field={form.tieneReferido} label="Tengo un código de referido"
                     onChange={checked => form.setTieneReferido(checked)} />
      <TextField form={form} field={form.codigoReferido} label="Código de referido" placeholder="ABC-123" />

      <CheckboxField form={form} field={form.aceptaTerminos} label="Acepto los términos y condiciones" />

      <div className="acciones">
        <button type="submit" disabled={form.submitting}>{form.submitting ? 'Creando…' : 'Crear cuenta'}</button>
      </div>
      <StateViewer form={form} />
    </form>
  );
}
