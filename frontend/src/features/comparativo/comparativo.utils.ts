import type { TonoEstado } from "../../components/ui/patrones";
import { formatoCantidad } from "../../common/utils/numeros";
import { COLOR_CUMPLIMIENTO, COLOR_ESTADO, COLOR_SERIE } from "../dashboard/types/coloresGraficos";

/* ─────────────────────────────── Tipos ─────────────────────────────── */
/* Respuesta de `GET /paneles/comparativo` (backend `paneles/schemas.py`). */

export interface ValorSede {
  establecimiento_id: number;
  valor: number | null;
}

export interface IndicadorComparativo {
  clave: string;
  etiqueta: string;
  descripcion: string;
  formato: "porcentaje" | "cantidad";
  mejor: "alto" | "bajo";
  valores: ValorSede[];
  promedio_empresa: number | null;
  valor_propio: number | null;
  posicion_propia: number | null;
}

export interface Sede {
  id: number;
  nombre: string;
}

export interface TableroComparativo {
  establecimiento_propio_id: number;
  establecimientos: Sede[];
  indicadores: IndicadorComparativo[];
}

/* ─────────────────────────────── Colores ─────────────────────────────── */

/*
 * No hay un color por sede: la pregunta es "¿cómo está MI sede frente al
 * resto?". La propia va en el teal de cumplimiento y las demás en gris de
 * contexto; el promedio de la empresa, en una línea punteada. Donde menos es
 * mejor, la propia va en naranja si está peor que el promedio. La identidad
 * nunca va solo por color: la propia dice "Tu sede" y va en negrita.
 */
export const COLOR_PROPIA = COLOR_CUMPLIMIENTO;
export const COLOR_OTRAS = COLOR_ESTADO.neutro;
export const COLOR_PEOR = COLOR_SERIE.naranja;
export const COLOR_PROMEDIO = "var(--chakra-colors-gray-500)";

/** Nombre corto de cada indicador de cumplimiento, para los ejes. */
export const ETIQUETA_CORTA: Record<string, string> = {
  cumplimiento_limpieza: "Limpieza",
  equipos_al_dia: "Equipos",
  personal_apto: "Aptitudes",
  documentos_vigentes: "Documentación",
  elementos_al_dia: "Elementos",
};

/* ─────────────────────────────── Cálculos ─────────────────────────────── */

export function textoValor(valor: number | null | undefined, formato: IndicadorComparativo["formato"]): string {
  if (valor === null || valor === undefined) return "Sin datos";
  return formato === "porcentaje" ? `${formatoCantidad(valor)}%` : formatoCantidad(valor);
}

/** Cuántas sedes tienen dato: el puesto es entre ellas. */
export function sedesConDato(indicador: IndicadorComparativo): number {
  return indicador.valores.filter((v) => v.valor !== null).length;
}

/** Puesto de un valor entre las sedes con dato (1 = el mejor), como el backend. */
export function posicionDe(indicador: IndicadorComparativo, valor: number | null): number | null {
  if (valor === null) return null;
  const otros = indicador.valores.map((v) => v.valor).filter((v): v is number => v !== null);
  return 1 + otros.filter((v) => (indicador.mejor === "alto" ? v > valor : v < valor)).length;
}

/** "2° de 3", o `null` si no hay con quién comparar. */
export function textoPuesto(indicador: IndicadorComparativo, valor: number | null): string | null {
  const total = sedesConDato(indicador);
  const puesto = posicionDe(indicador, valor);
  return puesto === null || total < 2 ? null : `${puesto}° de ${total}`;
}

export interface Desvio {
  /** Valor menos promedio, con signo. */
  diferencia: number;
  /** "+24,4 pts", "−3". */
  texto: string;
  /** Mejor, peor o igual que la empresa, según si conviene más o menos. */
  tono: TonoEstado;
  /**
   * Distancia relativa al promedio, positiva si es mejor: permite comparar
   * un porcentaje con una cantidad para elegir fortaleza y oportunidad.
   */
  relativo: number;
}

/** Cuánto se aparta un valor del promedio de la empresa, o `null` si falta alguno. */
export function desvio(indicador: IndicadorComparativo, valor: number | null): Desvio | null {
  const promedio = indicador.promedio_empresa;
  if (valor === null || promedio === null) return null;
  const diferencia = Math.round((valor - promedio) * 10) / 10;
  const signo = indicador.mejor === "alto" ? 1 : -1;
  const relativo =
    promedio === 0 ? (diferencia === 0 ? 0 : signo * Math.sign(diferencia)) : (signo * diferencia) / Math.abs(promedio);
  const cuanto = `${formatoCantidad(Math.abs(diferencia))}${indicador.formato === "porcentaje" ? " pts" : ""}`;
  if (diferencia === 0) return { diferencia, texto: "En el promedio", tono: "neutro", relativo: 0 };
  return {
    diferencia,
    texto: `${diferencia > 0 ? "+" : "−"}${cuanto}`,
    tono: relativo > 0 ? "ok" : "alerta",
    relativo,
  };
}

/** "+11 sobre el promedio", "−16,7 pts bajo el promedio". */
export function textoDesvio(d: Desvio): string {
  if (d.diferencia === 0) return d.texto;
  return `${d.texto} ${d.diferencia > 0 ? "sobre" : "bajo"} el promedio`;
}

export interface Destacado {
  indicador: IndicadorComparativo;
  desvio: Desvio;
}

/** El indicador donde la sede propia más se aparta del promedio, para bien o para mal. */
export function destacados(indicadores: IndicadorComparativo[]): {
  fortaleza: Destacado | null;
  oportunidad: Destacado | null;
} {
  const con = indicadores
    .map((indicador) => ({ indicador, desvio: desvio(indicador, indicador.valor_propio) }))
    .filter((d): d is Destacado => d.desvio !== null && sedesConDato(d.indicador) > 1);
  const ordenados = [...con].sort((a, b) => b.desvio.relativo - a.desvio.relativo);
  const mejor = ordenados[0];
  const peor = ordenados[ordenados.length - 1];
  return {
    fortaleza: mejor && mejor.desvio.relativo > 0 ? mejor : null,
    oportunidad: peor && peor.desvio.relativo < 0 ? peor : null,
  };
}

/** Cuántos indicadores ocupa la sede en cada puesto: [[1, 5], [3, 4]]. */
export function puestosPropios(indicadores: IndicadorComparativo[]): [number, number][] {
  const cuenta = new Map<number, number>();
  for (const i of indicadores) {
    if (i.posicion_propia === null || sedesConDato(i) < 2) continue;
    cuenta.set(i.posicion_propia, (cuenta.get(i.posicion_propia) ?? 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => a[0] - b[0]);
}

/** "Planta Norte Industrial" → "Planta Norte I…": entra en el eje. */
export function nombreCorto(nombre: string, largo = 22): string {
  return nombre.length <= largo ? nombre : `${nombre.slice(0, largo - 1)}…`;
}
