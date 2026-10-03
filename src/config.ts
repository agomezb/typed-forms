import type { ValidationErrors } from './validators.js';

export type ShowErrorsWhen = 'submitted' | 'touched' | 'dirty' | 'always';

export type Message = string | ((params: any) => string);

export interface MessageMap {
  [code: string]: Message;
}

export const mensajesEs: MessageMap = {
  required: 'Campo Requerido',
  minlength: (e: any) => `Debe tener por lo menos ${e.requiredLength}`,
  maxlength: (e: any) => `Debe tener máximo ${e.requiredLength}`,
  min: (e: any) => `El valor mínimo es ${e.min}`,
  max: (e: any) => `El valor máximo es ${e.max}`,
  email: 'Correo inválido',
  pattern: 'Formato incorrecto',
};

export interface FormsConfig {
  messages: MessageMap;
  fallbackMessage: string;
  showErrorsWhen: ShowErrorsWhen;
}

const config: FormsConfig = {
  messages: { ...mensajesEs },
  fallbackMessage: 'Valor Incorrecto',
  showErrorsWhen: 'submitted',
};

/** Configuración global; cada formulario puede sobrescribirla en su constructor. */
export function configureForms(options: Partial<FormsConfig>): void {
  if (options.messages) {
    Object.assign(config.messages, options.messages);
  }
  if (options.fallbackMessage !== undefined) {
    config.fallbackMessage = options.fallbackMessage;
  }
  if (options.showErrorsWhen) {
    config.showErrorsWhen = options.showErrorsWhen;
  }
}

export function getConfig(): Readonly<FormsConfig> {
  return config;
}

export function messageFor(errors: ValidationErrors, local?: MessageMap): string {
  for (const code of Object.keys(errors)) {
    const message = (local && local[code]) || config.messages[code];
    if (message !== undefined) {
      return typeof message === 'function' ? message(errors[code]) : message;
    }
  }
  return config.fallbackMessage;
}
