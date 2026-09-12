// 1. Tipo de Unión (sustituye al enum)
export type TipoEquipo = 'heladera' | 'horno' | 'balanza' | 'termometro';

// 2. Objeto auxiliar constante (opcional, muy útil para formularios o desplegables)
export const TIPO_EQUIPO_OPTIONS: TipoEquipo[] = [
  'heladera',
  'horno',
  'balanza',
  'termometro',
];

// 3. Interfaz del Equipo
export interface Equipo {
  id: number;
  nombre: string;
  tipo: TipoEquipo;
  ubicacion: string;
  activo: boolean;
}