import { useState, type ReactNode } from 'react';
import { LoginExample } from './examples/LoginExample';
import { RegistroExample } from './examples/RegistroExample';
import { ReunionExample } from './examples/ReunionExample';

interface Ejemplo {
  titulo: string;
  descripcion: ReactNode;
  render: () => ReactNode;
}

const ejemplos: Ejemplo[] = [
  {
    titulo: 'Login',
    descripcion: <>Formulario funcional con <code>createForm</code>, envío asíncrono y errores al enviar.</>,
    render: () => <LoginExample />,
  },
  {
    titulo: 'Registro',
    descripcion: (
      <>
        Clase <code>FormModel</code> con validación cruzada (confirmar clave), campos que se
        habilitan/deshabilitan y errores al salir del campo (<code>showErrorsWhen: 'touched'</code>).
      </>
    ),
    render: () => <RegistroExample />,
  },
  {
    titulo: 'Reunión',
    descripcion: (
      <>
        Lista dinámica de subformularios con <code>fieldArray</code>, validación condicional con{' '}
        <code>when</code>, un campo con objetos que se valida contra la lista y carga asíncrona con{' '}
        <code>patch</code>. Prueba buscar <code>ana.perez@empresa.com</code> o <code>john@proveedor.com</code>.
      </>
    ),
    render: () => <ReunionExample />,
  },
];

export function App() {
  const [actual, setActual] = useState(0);
  const ejemplo = ejemplos[actual];

  return (
    <main>
      <header>
        <h1>typed-forms <span>+ React</span></h1>
        <p>Formularios tipados conectados con <code>useSyncExternalStore</code>, sin adaptadores.</p>
      </header>

      <nav role="tablist">
        {ejemplos.map((e, i) => (
          <button key={e.titulo} role="tab" aria-selected={i === actual} onClick={() => setActual(i)}>
            {e.titulo}
          </button>
        ))}
      </nav>

      <section role="tabpanel" className="panel">
        <p className="descripcion">{ejemplo.descripcion}</p>
        {/* `key` para que cada pestaña cree su propio formulario al montarse */}
        <div key={actual}>{ejemplo.render()}</div>
      </section>
    </main>
  );
}
