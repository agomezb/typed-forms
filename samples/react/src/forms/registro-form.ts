import { FormModel, field, required, email, minLength, pattern, rule } from 'typed-forms';

export class RegistroForm extends FormModel<RegistroForm> {
  nombre = field('', required);
  correo = field('', [required, email]);
  clave = field('', [required, minLength(8)]);
  // Validación cruzada: el validador lee otro campo y siempre ve su valor actual.
  confirmacion = field('', [required, rule<string>('no_coincide', v => v === this.clave.value)]);
  tieneReferido = field(false);
  // Deshabilitado = sin errores. Se habilita solo si el usuario marca que tiene referido.
  codigoReferido = field('', [required, pattern(/^[A-Z]{3}-\d{3}$/)], { disabled: true });
  aceptaTerminos = field(false, rule<boolean>('terminos', v => v));

  constructor() {
    // Opciones propias de este formulario: errores al salir del campo y un mensaje específico.
    super({ showErrorsWhen: 'touched', messages: { pattern: 'Formato: ABC-123' } });
  }

  setTieneReferido(tiene: boolean): void {
    this.batch(() => {
      this.tieneReferido.setValue(tiene);
      if (tiene) {
        this.codigoReferido.enable();
      } else {
        this.codigoReferido.disable();
      }
    });
  }

  override reset(): void {
    this.batch(() => {
      super.reset();
      this.codigoReferido.disable();
    });
  }
}
