import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureForms } from 'typed-forms';
import { App } from './App';
import './styles.css';

// Configuración global: mensajes para los códigos de error propios de la app.
// Los de los validadores incluidos (required, email, minlength…) ya vienen en español.
configureForms({
  messages: {
    correo_interno: 'Use el correo de la empresa',
    fecha_pasada: 'La fecha no puede ser anterior a hoy',
    hora_fin: 'Debe ser posterior a la hora de inicio',
    capacidad: (e: { max: number }) => `La sala admite máximo ${e.max} personas`,
    no_coincide: 'Las claves no coinciden',
    terminos: 'Debe aceptar los términos',
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
