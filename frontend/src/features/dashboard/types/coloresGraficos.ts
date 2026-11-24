import type { TonoEstado } from "../../../components/ui/patrones";
import type { Conteo, Serie } from "./paneles";

/*
 * Colores y ayudas de los gráficos de los paneles (`components/graficos.tsx`).
 * Van aparte del archivo de componentes para no romper el fast refresh.
 */

export const COLOR_SERIE = {
  azul: "#2a78d6",
  naranja: "#eb6834",
  aqua: "#1baf7a",
} as const;

export const COLOR_ESTADO: Record<TonoEstado, string> = {
  ok: "#0ca30c",
  alerta: "#fab219",
  peligro: "#d03b3b",
  info: "#2a78d6",
  neutro: "#a3acb9",
};

/**
 * Tonos cálidos de la marca, para repartos donde los estados no son un
 * semáforo de alarma (p. ej. salidas): terracota, ocre, salvia, crema y
 * piedra. Van siempre con su leyenda al lado; el crema es el más claro, así
 * que conviene darlo a la parte menos importante del reparto.
 */
export const COLOR_CALIDO = {
  terracota: "#b85a3c",
  ocre: "#c99a3b",
  salvia: "#7a9a6b",
  crema: "#e4cf9e",
  piedra: "#a69d8f",
} as const;

/** Teal de cumplimiento: el de las barras horizontales y las paletas. */
export const COLOR_CUMPLIMIENTO = "#009b8f";

/**
 * Los cinco primeros tonos de la paleta categórica de referencia, en su orden
 * fijo (azul, naranja, aqua, amarillo, magenta), para repartir un total entre
 * entidades distintas (p. ej. salidas por transportista). Validados juntos,
 * también para daltonismo; el oscuro tiene sus propios pasos contra el fondo
 * oscuro. Van siempre con la leyenda al lado (nombre y valor).
 */
export const CATEGORICO = {
  claro: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  oscuro: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
} as const;

export interface ParteDona extends Conteo {
  color: string;
}

/** Suma los colores a los conteos del backend, por clave. */
export function conColor(conteos: Conteo[], colores: Record<string, string>): ParteDona[] {
  return conteos.map((c) => ({ ...c, color: colores[c.clave] ?? COLOR_ESTADO.neutro }));
}

/** `true` si la serie no tiene ningún valor distinto de cero en esas claves. */
export function serieVacia(serie: Serie, claves: string[]): boolean {
  return serie.puntos.every((p) => claves.every((c) => !p.valores[c]));
}
