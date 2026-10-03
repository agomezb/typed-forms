import { FormModel, field, fieldArray, required, email, rule, when } from 'typed-forms';
import { DOMINIO_INTERNO, type Persona, type Sala } from '../api';

const correoInterno = rule<string>('correo_interno', v => v.endsWith(DOMINIO_INTERNO));

const hoy = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

let siguienteId = 0;

export class AsistenteForm extends FormModel<AsistenteForm> {
  readonly id = ++siguienteId; // no es un campo: se ignora en `value` (sirve como `key` en React)
  esExterno = field(false);
  // Los internos deben usar el correo de la empresa; `when` reevalúa la condición en cada cambio.
  correo = field('', [required, email, when(() => !this.esExterno.value, correoInterno)]);
  nombre = field('', required);
  empresa = field('', when(() => this.esExterno.value, required));

  load(persona: Persona): void {
    this.patch(persona);
  }
}

export class ReunionForm extends FormModel<ReunionForm> {
  titulo = field('', required);
  fecha = field('', [required, rule<string>('fecha_pasada', v => v >= hoy())]);
  horaInicio = field('', required);
  horaFin = field('', [required, rule<string>('hora_fin', v => v > this.horaInicio.value)]);
  sala = field<Sala | null>(null, [
    required,
    // Lee la lista de asistentes: se revalida sola al agregar o quitar personas.
    sala => sala && this.asistentes.length > sala.capacidad ? { capacidad: { max: sala.capacidad } } : null,
  ]);
  asistentes = fieldArray([new AsistenteForm()]);

  get lugaresLibres(): number | null {
    return this.sala.value ? this.sala.value.capacidad - this.asistentes.length : null;
  }

  agregarAsistente(): void {
    this.asistentes.push(new AsistenteForm());
  }

  quitarAsistente(index: number): void {
    this.asistentes.removeAt(index);
  }

  /** Vuelve al estado inicial, dejando un solo asistente. */
  override reset(): void {
    this.batch(() => {
      while (this.asistentes.length > 1) {
        this.asistentes.removeAt(this.asistentes.length - 1);
      }
      super.reset();
    });
  }
}
