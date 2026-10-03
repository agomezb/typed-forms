import 'global-jsdom/register';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { FormModel, field, required, minLength } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class LoginForm extends FormModel<LoginForm> {
  usuario = field('', required);
  clave = field('', [required, minLength(4)]);
}

type Credenciales = LoginForm['value'];

// Sin adaptador: solo APIs nativas de React.
function Login({ form, onLogin }: { form: LoginForm; onLogin: (c: Credenciales) => Promise<void> }) {
  useSyncExternalStore(form.subscribe, form.getState);
  return (
    <form onSubmit={e => { e.preventDefault(); void form.submit(onLogin); }}>
      <input name="usuario" value={form.usuario.value}
             onChange={e => form.usuario.setValue(e.target.value)} onBlur={form.usuario.markTouched} />
      {form.showError('usuario') && <span id="error-usuario">{form.errorMessage('usuario')}</span>}
      <input name="clave" value={form.clave.value} onChange={e => form.clave.setValue(e.target.value)} />
      {form.showError('clave') && <span id="error-clave">{form.errorMessage('clave')}</span>}
      <button type="submit" disabled={form.submitting}>Entrar</button>
    </form>
  );
}

function App({ onLogin }: { onLogin: (c: Credenciales) => Promise<void> }) {
  const [form] = useState(() => new LoginForm());
  (globalThis as { loginForm?: LoginForm }).loginForm = form;
  return <Login form={form} onLogin={onLogin} />;
}

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel);

/** Escribe en un input controlado como lo haría el navegador. */
function escribir(input: HTMLInputElement, valor: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, valor);
  input.dispatchEvent(new (input.ownerDocument.defaultView!.Event)('input', { bubbles: true }));
}

test('React 19: formulario de login sin adaptador', async () => {
  const contenedor = document.body.appendChild(document.createElement('div'));
  const root = createRoot(contenedor);
  const recibidos: Credenciales[] = [];
  let terminarLogin!: () => void;
  const onLogin = (c: Credenciales) => {
    recibidos.push(c);
    return new Promise<void>(ok => { terminarLogin = ok; });
  };

  await act(async () => root.render(<App onLogin={onLogin} />));
  assert.equal($('#error-usuario'), null, 'sin errores antes de enviar');

  // Enviar vacío: aparecen los mensajes y no se llama a onLogin
  await act(async () => $<HTMLButtonElement>('button')!.click());
  assert.equal($('#error-usuario')?.textContent, 'Campo Requerido');
  assert.equal($('#error-clave')?.textContent, 'Campo Requerido');
  assert.equal(recibidos.length, 0);

  // Escribir actualiza el formulario y re-renderiza
  await act(async () => escribir($<HTMLInputElement>('[name=usuario]')!, 'ana'));
  await act(async () => escribir($<HTMLInputElement>('[name=clave]')!, 'ab'));
  assert.equal($('#error-usuario'), null);
  assert.equal($('#error-clave')?.textContent, 'Debe tener por lo menos 4');

  // Cambio externo (fuera de un evento de React, p. ej. después de un await): también re-renderiza
  const form = (globalThis as { loginForm?: LoginForm }).loginForm!;
  await act(async () => { await Promise.resolve(); form.patch({ clave: 'abcd' }); });
  assert.equal($<HTMLInputElement>('[name=clave]')!.value, 'abcd');
  assert.equal($('#error-clave'), null);

  // Envío válido: botón deshabilitado mientras se procesa
  await act(async () => $<HTMLButtonElement>('button')!.click());
  assert.deepEqual(recibidos, [{ usuario: 'ana', clave: 'abcd' }]);
  assert.equal($<HTMLButtonElement>('button')!.disabled, true);
  await act(async () => terminarLogin());
  assert.equal($<HTMLButtonElement>('button')!.disabled, false);

  await act(async () => root.unmount());
});
