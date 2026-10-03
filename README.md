# typed-forms

Formularios tipados en TypeScript, **sin dependencias** y sin código de ningún framework.
Se usa en React y en Angular con sus APIs nativas, sin adaptadores.

Requisitos: TypeScript ≥ 5.4 y salida ES2022 o superior.

## Definir un formulario

Cada propiedad creada con `field()` es un campo. Se registra sola; no hay que llamar a ningún `initialize()`.

```ts
import { FormModel, field, required, when, rule } from 'typed-forms';

const idValida = rule<string>('id_invalida', v => /^\d{10}(\d{3})?$/.test(v));

class PasajeroForm extends FormModel<PasajeroForm> {
  esExtranjero = field(false);
  identificacion = field('', [required, when(() => !this.esExtranjero.value, idValida)]);
  nombre = field('', required);
  cliente: Cliente | null = null;            // lo que no es campo se ignora

  load(c: Cliente) { this.cliente = c; this.patch({ identificacion: c.identificacion, nombre: c.nombre }); }
  toEntity(): Cliente { return { ...this.cliente, ...this.value }; }
}
```

- El parámetro `<PasajeroForm>` es obligatorio: tipa `value`, `patch` y los nombres de campo también dentro de la clase. Si se omite, no hay error, pero el tipado queda en `any`.
- No se pueden usar como nombre de campo los miembros de `FormModel` (`value`, `valid`, `submit`…). TypeScript avisa si se intenta.
- Los campos se declaran como propiedades de la clase y no se reasignan; para cambiar el valor se usa `setValue` o `patch`.

Para formularios simples existe la variante funcional:

```ts
const login = createForm({ usuario: field('', required), clave: field('', [required, minLength(4)]) });
```

### Validadores

`required`, `minLength`, `maxLength`, `pattern`, `min`, `max`, `email`, `rule(codigo, predicado)` y `when(condicion, ...validadores)`.

Los errores se calculan al leerlos, así que un validador puede leer otros campos y siempre ve los valores actuales:

```ts
confirmacion = field('', [required, rule<string>('no_coincide', v => v === this.clave.value)]);
```

`setValidators()` también se aplica de inmediato. No existe `updateValueAndValidity`.

### Errores y mensajes

```ts
form.showError('nombre');     // ¿mostrarlo ahora? según la política de visualización
form.errorMessage('nombre');  // 'Campo Requerido'
```

La política se define con `showErrorsWhen`: `'submitted'` (por defecto), `'touched'`, `'dirty'` o `'always'`. Los mensajes se configuran por código de error:

```ts
configureForms({ messages: { id_invalida: 'Identificación inválida' }, showErrorsWhen: 'touched' });
new MiForm({ messages: { required: 'Obligatorio' } }); // o por formulario
```

### Enviar

```ts
const r = await form.submit(value => api.guardar(value));
// { ok: true, result } | { ok: false, reason: 'invalid' | 'busy' }
```

Mientras el envío está en curso, `form.submitting` es `true` y un segundo `submit()` se rechaza.

### Listas

```ts
const venta = createForm({ pasajeros: fieldArray([new PasajeroForm(), new PasajeroForm()]) });
venta.pasajeros.push(new PasajeroForm());
```

Los formularios de la lista heredan el estado de "enviado" del formulario raíz.

## React

```tsx
function Login() {
  const [form] = useState(() => new LoginForm());
  useSyncExternalStore(form.subscribe, form.getState);

  return (
    <form onSubmit={e => { e.preventDefault(); form.submit(api.login); }}>
      <input value={form.usuario.value} onChange={e => form.usuario.setValue(e.target.value)}
             onBlur={form.usuario.markTouched} />
      {form.showError('usuario') && <span>{form.errorMessage('usuario')}</span>}
      <button disabled={form.submitting}>Entrar</button>
    </form>
  );
}
```

Ejemplo completo y ejecutable en [samples/react](samples/react).

## Angular

```ts
@Component({
  imports: [FormsModule],
  template: `
    @let s = state();
    <input [ngModel]="form.usuario.value" (ngModelChange)="form.usuario.setValue($event)"
           (blur)="form.usuario.markTouched()">
    @if (form.showError('usuario')) { <span>{{ form.errorMessage('usuario') }}</span> }
    <select [ngModel]="form.cooperativa.value" (ngModelChange)="form.cooperativa.setValue($event)"
            [compareWith]="compareById"> ... </select>
    <button (click)="form.submit(guardar)" [disabled]="s.submitting">Guardar</button>
  `,
})
class LoginComponent {
  form = new LoginForm();
  state = toSignal(this.form, { requireSync: true });   // se desuscribe solo al destruirse
  compareById = compareById;
  guardar = (v: LoginForm['value']) => this.api.login(v);
}
```

- **El template tiene que leer `state()`** (por ejemplo con `@let s = state();`). Eso le avisa a Angular de cada cambio del formulario, también los que ocurren fuera de un evento, como después de un `await`. Sin esa lectura, en modo zoneless la vista no se actualiza.
- `[ngModel]`/`(ngModelChange)` funciona con cualquier componente que implemente `ControlValueAccessor` (Material, ng-bootstrap, etc.).

## Cómo se conecta sin adaptadores

`form.subscribe` cumple dos contratos a la vez:

- **React:** recibe una función y devuelve una función para desuscribirse (`useSyncExternalStore`).
- **Angular y RxJS:** recibe un observer `{ next }` y devuelve un objeto con `.unsubscribe()` (`Subscribable`, que acepta `toSignal`). Con un observer, el estado actual se emite de inmediato.

`form.getState()` devuelve un estado inmutable que conserva la misma referencia hasta el siguiente cambio.

## Desarrollo

```bash
npm install
npm test
```

`npm test` compila la librería y corre las pruebas del núcleo, la integración con React 19 y la integración con Angular 22 (zoneless, jsdom). Todo se corre dos veces: con los campos de clase de ES2022 (Vite/React) y con `useDefineForClassFields: false` (Angular CLI).
