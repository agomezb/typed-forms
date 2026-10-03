import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FormModel, field, createForm, fieldArray, required, minLength, pattern, rule, when, compareById,
  type FormValue, type FieldName,
} from '../src/index.js';

// ---- utilidades de tipos (fallan en compilación si el tipo no coincide) ----
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const expectType = <T extends true>(): void => undefined;

// ---- dominio de ejemplo (equivalente a posterminal) ----
interface Ruta { id: number; ciudad: string }
interface Frecuencia { id: number; hora: string; ruta: Ruta }
interface Viaje { id?: number; fecha: Date; frecuencia: Frecuencia; conductor: string | null; adicional: string }

const quito: Ruta = { id: 1, ciudad: 'Quito' };
const viajeGuardado: Viaje = {
  id: 99, fecha: new Date(2026, 9, 2), frecuencia: { id: 7, hora: '08:30', ruta: quito }, conductor: 'Luis', adicional: '',
};

// RegistrarViajeForm sin super.initialize(): los campos se registran solos.
class ViajeForm extends FormModel<ViajeForm> {
  fecha = field<Date | null>(null, required);
  destino = field<Ruta | null>(null, required);
  frecuencia = field<Frecuencia | null>(null, required);
  conductor = field<string | null>(null);
  adicional = field('');
  viaje: Viaje | null = null; // estado que no es un campo: se ignora

  load(viaje: Viaje): void {
    this.viaje = viaje;
    this.patch({ fecha: viaje.fecha, destino: viaje.frecuencia.ruta, frecuencia: viaje.frecuencia, conductor: viaje.conductor });
  }

  toEntity(): Viaje {
    const v = this.value;
    return { ...(this.viaje ?? {}), fecha: v.fecha!, frecuencia: v.frecuencia!, conductor: v.conductor, adicional: v.adicional };
  }
}

expectType<Equal<FieldName<ViajeForm>, 'fecha' | 'destino' | 'frecuencia' | 'conductor' | 'adicional'>>();
expectType<Equal<FormValue<ViajeForm>['frecuencia'], Frecuencia | null>>();
expectType<Equal<keyof FormValue<ViajeForm>, FieldName<ViajeForm>>>();

{
  const f = new ViajeForm();
  // @ts-expect-error campo inexistente
  f.showError('noExiste');
  // @ts-expect-error 'viaje' no es un campo
  f.showError('viaje');
  // @ts-expect-error tipo de valor incorrecto
  f.fecha.setValue('2026-10-02');
  // @ts-expect-error patch valida claves y tipos
  f.patch({ fecha: 'hoy' });
}

class NombreReservado extends FormModel<NombreReservado> {
  // @ts-expect-error choca con un miembro de FormModel
  value = field('');
}
void NombreReservado;

test('registra los campos sin initialize() e ignora lo que no es campo', () => {
  const f = new ViajeForm();
  assert.deepEqual(f.children().map(([name]) => name), ['fecha', 'destino', 'frecuencia', 'conductor', 'adicional']);
  assert.equal(f.valid, false);
  f.load(viajeGuardado);
  assert.equal(f.valid, true);
  const entidad = f.toEntity();
  assert.equal(entidad.id, 99);
  assert.equal(entidad.frecuencia.id, 7);
});

test('errores visibles solo después de enviar, con los mensajes de FormBase', async () => {
  const f = new ViajeForm();
  assert.equal(f.showError('fecha'), false);
  let llamado = false;
  const r = await f.submit(() => { llamado = true; });
  assert.deepEqual(r, { ok: false, reason: 'invalid' });
  assert.equal(llamado, false);
  assert.equal(f.showError('fecha'), true);
  assert.equal(f.showError(f.adicional), false);
  assert.equal(f.errorMessage('fecha'), 'Campo Requerido');

  const g = createForm({ codigo: field('ab', [minLength(3)]), raro: field('x', rule('desconocido', () => false)) });
  assert.equal(g.errorMessage('codigo'), 'Debe tener por lo menos 3');
  assert.equal(g.errorMessage('raro'), 'Valor Incorrecto');

  const h = createForm({ raro: field('x', rule('desconocido', () => false)) }, { messages: { desconocido: 'Mensaje propio' } });
  assert.equal(h.errorMessage('raro'), 'Mensaje propio');
});

test('política touched: muestra el error al salir del campo', () => {
  const f = createForm({ nombre: field('', required) }, { showErrorsWhen: 'touched' });
  assert.equal(f.showError('nombre'), false);
  f.nombre.markTouched();
  assert.equal(f.showError('nombre'), true);
});

// RegistoPasajeroForm / VentaBoletoForm: el validador de identificación depende de esExtranjero.
const idValida = rule<string>('id_invalida', v => /^\d{10}(\d{3})?$/.test(v));
class PasajeroForm extends FormModel<PasajeroForm> {
  esExtranjero = field(false);
  identificacion = field('', [required, when(() => !this.esExtranjero.value, idValida)]);
  nombre = field('', [required, rule<string>('nombre_invalido', v => v.trim() !== '')]);
}

test('validación condicional sin suscripciones ni updateValueAndValidity manuales', () => {
  const p = new PasajeroForm();
  p.patch({ identificacion: 'AB123', nombre: 'ANA' });
  assert.deepEqual(p.identificacion.errors, { id_invalida: true });
  p.esExtranjero.setValue(true);
  assert.equal(p.identificacion.errors, null);
  assert.equal(p.valid, true);
  p.esExtranjero.setValue(false);
  assert.equal(p.valid, false);
});

test('setValidators se aplica de inmediato (el error de "motivo" en nueva-sol-usuario)', () => {
  const f = createForm({ tipo: field('Inhabilitar'), motivo: field('') });
  assert.equal(f.valid, true);
  f.motivo.setValidators(required);
  assert.equal(f.valid, false);
});

test('validación entre campos: confirmación de clave', () => {
  class UsuarioForm extends FormModel<UsuarioForm> {
    clave = field('', required);
    confirmacion = field('', [required, rule<string>('no_coincide', v => v === this.clave.value)]);
  }
  const f = new UsuarioForm();
  f.patch({ clave: 'abc', confirmacion: 'abc' });
  assert.equal(f.valid, true);
  f.clave.setValue('abcd'); // solo cambia clave; confirmacion se revalida sola
  assert.deepEqual(f.confirmacion.errors, { no_coincide: true });
});

test('submit: bloquea el doble envío y libera submitting aunque falle', async () => {
  const f = createForm({ usuario: field('ana', required) });
  let liberar!: () => void;
  const primero = f.submit(() => new Promise<string>(ok => { liberar = () => ok('guardado'); }));
  assert.equal(f.submitting, true);
  assert.deepEqual(await f.submit(() => 'otro'), { ok: false, reason: 'busy' });
  liberar();
  assert.deepEqual(await primero, { ok: true, result: 'guardado' });
  assert.equal(f.submitting, false);
  await assert.rejects(f.submit(() => { throw new Error('sin red'); }), /sin red/);
  assert.equal(f.submitting, false);
});

test('getState mantiene la referencia hasta un cambio; patch notifica una sola vez', () => {
  const f = new ViajeForm();
  const s1 = f.getState();
  assert.equal(f.getState(), s1);
  let avisos = 0;
  const off = f.subscribe(() => avisos++);
  f.load(viajeGuardado);
  assert.equal(avisos, 1);
  assert.notEqual(f.getState(), s1);
  assert.equal(f.getState().valid, true);
  assert.ok(Object.isFrozen(f.getState()));
  off();
  f.adicional.setValue('x');
  assert.equal(avisos, 1);
});

test('createForm + valor derivado: conteo de billetes de abrir caja', () => {
  const conteo = pattern(/^[0-9]{1,9}$/);
  const billetes = createForm({ cien: field('0', conteo), veinte: field('0', conteo), cincoCentavos: field('0', conteo) });
  const valores = { cien: 100, veinte: 20, cincoCentavos: 0.05 };
  const caja = createForm({ montoInicial: field('0.00', pattern(/^[0-9]+(\.[0-9]{1,2})?$/)), billetes });

  billetes.subscribe(() => {
    const v = billetes.value;
    const total = (Object.keys(valores) as Array<keyof typeof valores>)
      .reduce((acc, k) => acc + (Number(v[k]) || 0) * valores[k], 0);
    caja.montoInicial.setValue(total.toFixed(2));
  });

  billetes.cien.setValue('2');
  billetes.cincoCentavos.setValue('3');
  assert.equal(caja.montoInicial.value, '200.15');
  billetes.veinte.setValue('x');
  assert.equal(caja.valid, false);

  expectType<Equal<typeof caja.value, { montoInicial: string; billetes: { cien: string; veinte: string; cincoCentavos: string } }>>();
});

test('un listener que nunca se estabiliza se detecta en vez de colgar la app', () => {
  const f = createForm({ n: field(0) });
  f.subscribe(() => f.n.setValue(f.n.value + 1));
  assert.throws(() => f.n.setValue(1), /ciclo de actualizaciones/);
});

test('fieldArray: un formulario por pasajero, con submitted heredado', async () => {
  const venta = createForm({ pasajeros: fieldArray([new PasajeroForm(), new PasajeroForm()]) });
  assert.equal(venta.valid, false);
  const primero = venta.pasajeros.at(0)!;
  assert.equal(primero.showError('nombre'), false);
  await venta.submit(() => null);
  assert.equal(primero.showError('nombre'), true);

  for (const p of venta.pasajeros.items) {
    p.patch({ identificacion: '0102030405', nombre: 'ANA' });
  }
  assert.equal(venta.valid, true);
  venta.pasajeros.push(new PasajeroForm());
  assert.equal(venta.valid, false);
  venta.pasajeros.removeAt(2);
  assert.equal(venta.valid, true);
  assert.equal(venta.value.pasajeros[1]?.identificacion, '0102030405');

  expectType<Equal<(typeof venta.value)['pasajeros'][number]['esExtranjero'], boolean>>();
});

test('los campos deshabilitados no cuentan para la validez', () => {
  const f = createForm({ nombre: field('', required), email: field('') });
  assert.equal(f.valid, false);
  f.nombre.disable();
  assert.equal(f.valid, true);
  f.nombre.enable();
  assert.equal(f.valid, false);
});

test('reset vuelve a los valores iniciales y limpia submitted', async () => {
  const f = new ViajeForm();
  f.load(viajeGuardado);
  await f.submit(() => null);
  f.reset();
  assert.equal(f.fecha.value, null);
  assert.equal(f.submitted, false);
  assert.equal(f.fecha.dirty, false);
});

test('compareById para selects con objetos', () => {
  assert.equal(compareById({ id: 1 }, { id: 1 }), true);
  assert.equal(compareById({ id: 1 }, { id: 2 }), false);
  assert.equal(compareById(null, null), true);
  assert.equal(compareById({ id: 1 }, null), false);
});

test('funciona con dos copias del paquete (npm link, bundles duplicados)', async () => {
  // Las pruebas usan src compilado; dist/ es otra instancia del módulo, como una segunda copia instalada.
  const aqui = dirname(fileURLToPath(import.meta.url));
  const otra: typeof import('../src/index.js') = await import(pathToFileURL(resolve(aqui, '../../../dist/index.js')).href);
  assert.notEqual(otra.field, field); // de verdad es otra copia
  class Mixto extends FormModel<Mixto> {
    nombre = otra.field('', otra.required);
  }
  const f = new Mixto();
  assert.equal(f.children().length, 1);
  assert.equal(f.valid, false);
  f.nombre.setValue('x');
  assert.equal(f.valid, true);
});

test('subscribe con función: contrato de React useSyncExternalStore', () => {
  const f = createForm({ nombre: field('') });
  let avisos = 0;
  const off = f.subscribe(() => avisos++);
  assert.equal(avisos, 0); // no notifica al suscribirse
  f.nombre.setValue('a');
  assert.equal(avisos, 1);
  off(); // se puede llamar como función
  f.nombre.setValue('b');
  assert.equal(avisos, 1);
});

test('subscribe con observer: contrato Subscribable de Angular toSignal / RxJS', () => {
  const f = createForm({ nombre: field('', required) });
  const recibidos: boolean[] = [];
  const sub = f.subscribe({ next: s => recibidos.push(s.valid) });
  assert.deepEqual(recibidos, [false]); // estado actual de inmediato (requireSync)
  f.nombre.setValue('a');
  assert.deepEqual(recibidos, [false, true]);
  sub.unsubscribe(); // o .unsubscribe()
  f.nombre.setValue('');
  assert.deepEqual(recibidos, [false, true]);
});

test('setValue y markTouched se pueden pasar sin bind', () => {
  const f = createForm({ nombre: field('') }, { showErrorsWhen: 'touched' });
  const { setValue, markTouched } = f.nombre;
  setValue('x');
  markTouched();
  assert.equal(f.nombre.value, 'x');
  assert.equal(f.nombre.touched, true);
});
