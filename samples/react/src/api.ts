// API simulada: cada llamada tarda un poco para que se vea el estado `submitting`.

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Sala {
  id: number;
  nombre: string;
  capacidad: number;
}

export interface Persona {
  esExterno: boolean;
  correo: string;
  nombre: string;
  empresa: string;
}

export const DOMINIO_INTERNO = '@empresa.com';

export const salas: readonly Sala[] = [
  { id: 1, nombre: 'Sala Cotopaxi', capacidad: 3 },
  { id: 2, nombre: 'Sala Pacífico', capacidad: 8 },
  { id: 3, nombre: 'Auditorio', capacidad: 30 },
];

/** Horarios cada media hora, de 08:00 a 18:00. */
export const horas: readonly string[] = Array.from({ length: 21 }, (_, i) =>
  `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const directorio: readonly Persona[] = [
  { esExterno: false, correo: 'ana.perez@empresa.com', nombre: 'Ana Pérez', empresa: '' },
  { esExterno: true, correo: 'john@proveedor.com', nombre: 'John Smith', empresa: 'Proveedor S.A.' },
];

export async function login(credenciales: { usuario: string; clave: string }): Promise<{ nombre: string }> {
  await esperar(800);
  if (credenciales.clave !== '1234') {
    throw new Error('Usuario o clave incorrectos');
  }
  return { nombre: credenciales.usuario };
}

export async function registrar<T>(datos: T): Promise<T> {
  await esperar(800);
  return datos;
}

export async function buscarPersona(correo: string): Promise<Persona | null> {
  await esperar(500);
  return directorio.find(p => p.correo === correo.trim().toLowerCase()) ?? null;
}

export async function agendarReunion(reunion: { titulo: string; asistentes: unknown[] }) {
  await esperar(1200);
  return { titulo: reunion.titulo, invitaciones: reunion.asistentes.length };
}
