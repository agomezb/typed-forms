import { useState, useSyncExternalStore } from 'react';
import type { FormModel } from 'typed-forms';

/**
 * Crea el formulario una sola vez y vuelve a renderizar el componente en cada cambio.
 * No es un adaptador: son solo dos hooks nativos de React agrupados por comodidad.
 */
export function useForm<F extends FormModel>(create: () => F): F {
  const [form] = useState(create);
  useSyncExternalStore(form.subscribe, form.getState);
  return form;
}
