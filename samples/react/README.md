# typed-forms + React

App de ejemplo (Vite + React 19) con tres formularios que cubren casi toda la API:

| Ejemplo | Qué muestra |
| --- | --- |
| [Login](src/examples/LoginExample.tsx) | `createForm`, `submit` asíncrono, `submitting`, errores lanzados por el handler |
| [Registro](src/examples/RegistroExample.tsx) · [form](src/forms/registro-form.ts) | Clase `FormModel`, validación cruzada (`rule` que lee otro campo), `enable`/`disable`, `showErrorsWhen: 'touched'`, mensajes por formulario, `reset` |
| [Reunión](src/examples/ReunionExample.tsx) · [form](src/forms/reunion-form.ts) | `fieldArray` de subformularios, `when`, campo cuyo valor es un objeto y que se valida contra la lista (capacidad de la sala), `patch` después de un `await`, getters y métodos propios en la clase |

## Ejecutar

```bash
cd samples/react
npm install
npm run dev
```

No hace falta compilar la librería: [vite.config.ts](vite.config.ts) y [tsconfig.json](tsconfig.json) apuntan
`typed-forms` a `../../src`, así que los cambios en la librería se ven al instante. En un proyecto real
basta con instalar el paquete y quitar ese alias; los `import` no cambian.

`npm run build` comprueba los tipos (`tsc`) y genera el build de producción.

## Cómo se conecta

No hay adaptador. [use-form.ts](src/use-form.ts) solo agrupa los dos hooks nativos que pide la librería:

```ts
export function useForm<F extends FormModel>(create: () => F): F {
  const [form] = useState(create);
  useSyncExternalStore(form.subscribe, form.getState);
  return form;
}
```

Los inputs leen `field.value` y llaman a `field.setValue` / `field.markTouched`
(ver [components/fields.tsx](src/components/fields.tsx)). Los mensajes de los códigos de error propios de la
app se registran una vez con `configureForms` en [main.tsx](src/main.tsx).

Cada ejemplo tiene un panel **Estado del formulario** que muestra `form.getState()` en vivo.
