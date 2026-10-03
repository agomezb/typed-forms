import { useState, type FormEvent } from 'react';
import * as api from '../api';
import { CheckboxField, FieldError, SelectField, StateViewer, TextField } from '../components/fields';
import { ReunionForm, type AsistenteForm } from '../forms/reunion-form';
import { useForm } from '../use-form';

const contar = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export function ReunionExample() {
  const form = useForm(() => new ReunionForm());
  const [agendada, setAgendada] = useState<{ titulo: string; invitaciones: number } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = await form.submit(api.agendarReunion);
    if (r.ok) {
      setAgendada(r.result);
    }
  }

  function nuevaReunion() {
    form.reset();
    setAgendada(null);
  }

  if (agendada) {
    return (
      <div className="resultado">
        <p className="aviso">
          Reunión <strong>{agendada.titulo}</strong> agendada. Se enviaron {contar(agendada.invitaciones, 'invitación', 'invitaciones')}.
        </p>
        <button type="button" onClick={nuevaReunion}>Nueva reunión</button>
      </div>
    );
  }

  const libres = form.lugaresLibres;

  return (
    <form onSubmit={onSubmit} noValidate>
      <TextField form={form} field={form.titulo} label="Título" />
      <div className="fila">
        <TextField form={form} field={form.fecha} label="Fecha" type="date" />
        {/* Un campo cuyo valor es un objeto: el <select> trabaja con el id */}
        <div className="campo">
          <label htmlFor="sala">Sala</label>
          <select
            id="sala"
            value={form.sala.value?.id ?? ''}
            onChange={e => form.sala.setValue(api.salas.find(s => s.id === Number(e.target.value)) ?? null)}
            onBlur={form.sala.markTouched}
            aria-invalid={form.showError('sala')}
          >
            <option value="">Seleccione…</option>
            {api.salas.map(s => <option key={s.id} value={s.id}>{s.nombre} · {s.capacidad} personas</option>)}
          </select>
          <FieldError form={form} field={form.sala} />
        </div>
      </div>
      <div className="fila">
        <SelectField form={form} field={form.horaInicio} label="Desde" options={api.horas} />
        <SelectField form={form} field={form.horaFin} label="Hasta" options={api.horas} />
      </div>

      <h3>Asistentes</h3>
      {form.asistentes.items.map((asistente, i) => (
        <AsistenteFields
          key={asistente.id}
          asistente={asistente}
          numero={i + 1}
          onQuitar={form.asistentes.length > 1 ? () => form.quitarAsistente(i) : undefined}
        />
      ))}
      <button type="button" className="secundario" onClick={() => form.agregarAsistente()}>+ Agregar asistente</button>

      <div className="acciones">
        <span className="resumen">
          {contar(form.asistentes.length, 'asistente', 'asistentes')}
          {libres !== null && (libres >= 0 ? ` · ${contar(libres, 'lugar libre', 'lugares libres')}` : ` · ${contar(-libres, 'persona', 'personas')} de más`)}
        </span>
        <button type="submit" disabled={form.submitting}>{form.submitting ? 'Agendando…' : 'Agendar reunión'}</button>
      </div>
      <StateViewer form={form} />
    </form>
  );
}

function AsistenteFields({ asistente, numero, onQuitar }: {
  asistente: AsistenteForm;
  numero: number;
  onQuitar: (() => void) | undefined;
}) {
  const [buscando, setBuscando] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  async function buscar() {
    setBuscando(true);
    const persona = await api.buscarPersona(asistente.correo.value);
    setBuscando(false);
    setNoEncontrado(!persona);
    if (persona) {
      // Cambio fuera de un evento de React (después de un await): la vista se actualiza igual.
      asistente.load(persona);
    }
  }

  return (
    <fieldset className="asistente">
      <legend>Asistente {numero}</legend>
      {onQuitar && <button type="button" className="quitar" onClick={onQuitar} aria-label={`Quitar asistente ${numero}`}>✕</button>}

      <CheckboxField form={asistente} field={asistente.esExterno} label="Es externo a la empresa" />
      <div className="fila con-boton">
        <TextField form={asistente} field={asistente.correo} label="Correo" type="email"
                   placeholder={asistente.esExterno.value ? 'nombre@dominio.com' : `nombre${api.DOMINIO_INTERNO}`} />
        <button type="button" className="secundario" onClick={buscar}
                disabled={buscando || !asistente.correo.value}>
          {buscando ? 'Buscando…' : 'Buscar en directorio'}
        </button>
      </div>
      {noEncontrado && <p className="ayuda">No hay nadie con ese correo en el directorio.</p>}
      <div className="fila">
        <TextField form={asistente} field={asistente.nombre} label="Nombre" />
        {asistente.esExterno.value && <TextField form={asistente} field={asistente.empresa} label="Empresa" />}
      </div>
    </fieldset>
  );
}
