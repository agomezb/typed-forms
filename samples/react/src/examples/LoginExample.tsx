import { useState, type FormEvent } from 'react';
import { createForm, field, required, minLength } from 'typed-forms';
import * as api from '../api';
import { StateViewer, TextField } from '../components/fields';
import { useForm } from '../use-form';

// Variante funcional: para formularios simples no hace falta declarar una clase.
const crearLogin = () => createForm({
  usuario: field('', required),
  clave: field('', [required, minLength(4)]),
});

export function LoginExample() {
  const form = useForm(crearLogin);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMensaje(null);
    try {
      // `value` llega tipado como { usuario: string; clave: string }
      const r = await form.submit(api.login);
      if (r.ok) {
        setMensaje({ texto: `Bienvenido, ${r.result.nombre}`, ok: true });
      }
    } catch (error) {
      // Los errores del handler (p. ej. del servidor) se propagan tal cual.
      setMensaje({ texto: (error as Error).message, ok: false });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <TextField form={form} field={form.usuario} label="Usuario" autoComplete="username" />
      <TextField form={form} field={form.clave} label="Clave" type="password" autoComplete="current-password" />
      <p className="ayuda">La clave correcta es <code>1234</code>.</p>

      <div className="acciones">
        <button type="submit" disabled={form.submitting}>{form.submitting ? 'Entrando…' : 'Entrar'}</button>
      </div>
      {mensaje && <p className={mensaje.ok ? 'aviso' : 'aviso fallo'}>{mensaje.texto}</p>}
      <StateViewer form={form} />
    </form>
  );
}
