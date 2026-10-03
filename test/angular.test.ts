import 'global-jsdom/register';
import '@angular/compiler';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Component, provideZonelessChangeDetection, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { FormModel, field, required, minLength, compareById, type FormState } from '../src/index.js';

interface Cooperativa { id: number; nombre: string }
const cooperativas: Cooperativa[] = [{ id: 1, nombre: 'Andina' }, { id: 2, nombre: 'Costa' }];

class LoginForm extends FormModel<LoginForm> {
  usuario = field('', required);
  clave = field('', [required, minLength(4)]);
  cooperativa = field<Cooperativa | null>(null, required);
}

// Sin adaptador: toSignal() y ngModel son APIs nativas de Angular.
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    @let s = state();
    <input name="usuario" [ngModel]="form.usuario.value" (ngModelChange)="form.usuario.setValue($event)"
           (blur)="form.usuario.markTouched()">
    @if (form.showError('usuario')) { <span id="error-usuario">{{ form.errorMessage('usuario') }}</span> }

    <input name="clave" [ngModel]="form.clave.value" (ngModelChange)="form.clave.setValue($event)">
    @if (form.showError('clave')) { <span id="error-clave">{{ form.errorMessage('clave') }}</span> }

    <select name="cooperativa" [ngModel]="form.cooperativa.value" (ngModelChange)="form.cooperativa.setValue($event)"
            [compareWith]="compareById">
      @for (c of cooperativas; track c.id) { <option [ngValue]="c">{{ c.nombre }}</option> }
    </select>

    <button (click)="entrar()" [disabled]="s.submitting">Entrar</button>
  `,
})
class LoginComponent {
  readonly form = new LoginForm();
  readonly state = toSignal(this.form, { requireSync: true });
  readonly cooperativas = cooperativas;
  readonly compareById = compareById;
  recibidos: Array<LoginForm['value']> = [];
  terminar!: () => void;

  entrar(): Promise<unknown> {
    return this.form.submit(v => {
      this.recibidos.push(v);
      return new Promise<void>(ok => { this.terminar = ok; });
    });
  }
}

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

const escribir = (el: HTMLInputElement | HTMLSelectElement, valor: string, evento: 'input' | 'change') => {
  el.value = valor;
  el.dispatchEvent(new (el.ownerDocument.defaultView!.Event)(evento, { bubbles: true }));
};

test('Angular 22 zoneless: formulario de login sin adaptador', async () => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(LoginComponent);
  const cmp = fixture.componentInstance;
  const el = fixture.nativeElement as HTMLElement;
  const $ = <T extends Element>(sel: string) => el.querySelector<T>(sel);
  const estable = () => fixture.whenStable();

  // toSignal infiere el tipo del estado sin anotaciones
  const tipado: Signal<FormState<LoginForm>> = cmp.state;
  void tipado;

  await estable();
  assert.equal($('#error-usuario'), null);

  // Enviar vacío
  $<HTMLButtonElement>('button')!.click();
  await estable();
  assert.equal($('#error-usuario')?.textContent, 'Campo Requerido');
  assert.equal(cmp.recibidos.length, 0);

  // Escribir: ngModelChange -> field.setValue
  escribir($<HTMLInputElement>('[name=usuario]')!, 'ana', 'input');
  escribir($<HTMLInputElement>('[name=clave]')!, 'ab', 'input');
  await estable();
  assert.equal($('#error-usuario'), null);
  assert.equal($('#error-clave')?.textContent, 'Debe tener por lo menos 4');

  // Select con objetos: [ngValue] + compareWith
  const select = $<HTMLSelectElement>('[name=cooperativa]')!;
  escribir(select, select.options[1]!.value, 'change');
  await estable();
  assert.deepEqual(cmp.form.cooperativa.value, { id: 2, nombre: 'Costa' });

  // Cambio externo, fuera de cualquier evento: el signal dispara la detección de cambios
  cmp.form.patch({ clave: 'abcd', cooperativa: { id: 1, nombre: 'Andina' } });
  await estable();
  assert.equal($<HTMLInputElement>('[name=clave]')!.value, 'abcd');
  assert.equal($('#error-clave'), null);
  assert.equal(select.selectedIndex, 0, 'compareWith selecciona por id aunque sea otro objeto');

  // Envío válido: botón deshabilitado mientras se procesa
  void cmp.entrar();
  await estable();
  assert.deepEqual(cmp.recibidos, [{ usuario: 'ana', clave: 'abcd', cooperativa: { id: 1, nombre: 'Andina' } }]);
  assert.equal($<HTMLButtonElement>('button')!.disabled, true);
  cmp.terminar();
  await new Promise(r => setTimeout(r));
  await estable();
  assert.equal($<HTMLButtonElement>('button')!.disabled, false);

  // Al destruir el componente, toSignal se desuscribe solo
  fixture.destroy();
  const antes = cmp.state();
  cmp.form.usuario.setValue('otro');
  assert.equal(cmp.state(), antes);
});
