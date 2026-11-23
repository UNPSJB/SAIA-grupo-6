import { hoyISO } from "../../../common/utils/fechas";

export type FormatoDescarga = "png" | "pdf";

/** Período que cubre el gráfico, con fechas `AAAA-MM-DD`. */
export interface RangoGrafico {
  desde: string;
  hasta: string;
}

interface OpcionesNombre {
  /** Período del gráfico. Si no tiene (una foto de hoy), el nombre lleva la fecha de hoy. */
  rango?: RangoGrafico | null;
  /** Fecha de hoy `AAAA-MM-DD`. Solo se pasa en los tests. */
  hoy?: string;
}

const LARGO_MAXIMO_TITULO = 80;
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El título del gráfico escrito para un nombre de archivo: sin tildes, en minúsculas y con
 * guiones entre palabras ("Cumplimiento por sector y período" → "cumplimiento-por-sector-y-periodo").
 * Así no da problemas en Windows, en el correo ni en una presentación.
 */
export function slugDeTitulo(titulo: string): string {
  const slug = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LARGO_MAXIMO_TITULO)
    .replace(/-+$/g, "");
  return slug || "grafico";
}

function rangoValido(rango?: RangoGrafico | null): rango is RangoGrafico {
  return Boolean(rango && FORMATO_FECHA.test(rango.desde) && FORMATO_FECHA.test(rango.hasta));
}

/**
 * Nombre del archivo que se descarga: el título del gráfico y el período que muestra.
 *
 *   produccion-diaria_2026-11-01_2026-11-21.png
 *   estado-general-del-stock_2026-11-21.pdf   (sin período: la fecha de hoy)
 *
 * El título es el mismo texto que se escribe dentro del archivo, así el nombre y el contenido
 * siempre coinciden. Los filtros extra (producto, unidad) no van en el nombre.
 */
export function nombreArchivoGrafico(
  titulo: string,
  formato: FormatoDescarga,
  { rango, hoy }: OpcionesNombre = {},
): string {
  const slug = slugDeTitulo(titulo);
  let fechas: string;
  if (rangoValido(rango)) {
    fechas = rango.desde === rango.hasta ? rango.desde : `${rango.desde}_${rango.hasta}`;
  } else {
    fechas = hoy ?? hoyISO();
  }
  return `${slug}_${fechas}.${formato}`;
}
