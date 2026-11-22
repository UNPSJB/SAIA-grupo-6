import { formatoFecha, hoyISO } from "../../../common/utils/fechas";
import type { RangoGrafico } from "./nombreArchivoGrafico";

/**
 * Diseño de la hoja que se descarga: cabecera, título, período y el gráfico.
 * Son solo cuentas de posiciones y tamaños, sin tocar el navegador, para poder probarlas.
 */

export const FUENTE = "Inter, system-ui, sans-serif";
export const MARGEN = 24;
export const ANCHO_MINIMO = 640;
const ALTO_LOGO_MAXIMO = 44;
const ANCHO_LOGO_MAXIMO = 160;
const SEPARACION_LOGO = 12;

export interface Renglon {
  texto: string;
  x: number;
  y: number;
  /** Fuente en formato de canvas, por ejemplo "600 22px Inter". */
  fuente: string;
  color: string;
}

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Diseno {
  ancho: number;
  alto: number;
  renglones: Renglon[];
  /** Altura de la línea que separa la cabecera del título. */
  lineaY: number;
  imagen: Caja;
  logo: Caja | null;
}

export interface EntradaDiseno {
  /** Tamaño del gráfico capturado, en píxeles CSS (sin multiplicar por la escala). */
  anchoImagen: number;
  altoImagen: number;
  titulo: string;
  textoRango: string;
  /** Renglones de la cabecera: el primero es el nombre y los demás van más chicos. */
  cabecera: string[];
  logo?: { ancho: number; alto: number } | null;
}

export type MedirTexto = (texto: string, fuente: string) => number;

/** Cómo se escribe el período del gráfico debajo del título. */
export function textoRango(rango?: RangoGrafico | null, hoy: string = hoyISO()): string {
  if (rango && rango.desde && rango.hasta) {
    return rango.desde === rango.hasta
      ? `Fecha: ${formatoFecha(rango.desde)}`
      : `Período: ${formatoFecha(rango.desde)} al ${formatoFecha(rango.hasta)}`;
  }
  return `Datos al ${formatoFecha(hoy)}`;
}

/** Parte un texto en renglones que entren en `anchoMaximo`. Una palabra más larga queda entera. */
export function dividirEnRenglones(
  texto: string,
  anchoMaximo: number,
  fuente: string,
  medir: MedirTexto,
): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const renglones: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (actual && medir(candidato, fuente) > anchoMaximo) {
      renglones.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual) renglones.push(actual);
  return renglones.length ? renglones : [""];
}

/** Calcula dónde va cada cosa en la hoja. */
export function disenarHoja(entrada: EntradaDiseno, medir: MedirTexto): Diseno {
  const ancho = Math.max(entrada.anchoImagen + 2 * MARGEN, ANCHO_MINIMO);
  const anchoUtil = ancho - 2 * MARGEN;
  const renglones: Renglon[] = [];

  let y = MARGEN;

  // Cabecera: el logo (si hay) a la izquierda y el texto al lado.
  let logo: Caja | null = null;
  if (entrada.logo && entrada.logo.ancho > 0 && entrada.logo.alto > 0) {
    const factor = Math.min(
      ALTO_LOGO_MAXIMO / entrada.logo.alto,
      ANCHO_LOGO_MAXIMO / entrada.logo.ancho,
      1,
    );
    logo = {
      x: MARGEN,
      y,
      ancho: entrada.logo.ancho * factor,
      alto: entrada.logo.alto * factor,
    };
  }
  const xTexto = logo ? MARGEN + logo.ancho + SEPARACION_LOGO : MARGEN;
  let yTexto = y;
  entrada.cabecera.forEach((linea, indice) => {
    const esNombre = indice === 0;
    renglones.push({
      texto: linea,
      x: xTexto,
      y: yTexto,
      fuente: esNombre ? `700 18px ${FUENTE}` : `400 12px ${FUENTE}`,
      color: esNombre ? "#1f2937" : "#6b7280",
    });
    yTexto += esNombre ? 24 : 16;
  });
  const altoTextoCabecera = yTexto - y;
  y += Math.max(altoTextoCabecera, logo?.alto ?? 0) + 12;

  const lineaY = y;
  y += 16;

  // Título, partido en renglones si no entra.
  const fuenteTitulo = `600 22px ${FUENTE}`;
  for (const parte of dividirEnRenglones(entrada.titulo, anchoUtil, fuenteTitulo, medir)) {
    renglones.push({ texto: parte, x: MARGEN, y, fuente: fuenteTitulo, color: "#111827" });
    y += 28;
  }

  renglones.push({
    texto: entrada.textoRango,
    x: MARGEN,
    y: y + 2,
    fuente: `400 14px ${FUENTE}`,
    color: "#4b5563",
  });
  y += 28;

  const imagen: Caja = {
    x: (ancho - entrada.anchoImagen) / 2,
    y,
    ancho: entrada.anchoImagen,
    alto: entrada.altoImagen,
  };

  return { ancho, alto: y + entrada.altoImagen + MARGEN, renglones, lineaY, imagen, logo };
}

/** Tamaño y posición de la hoja dentro de una página, entera y centrada horizontalmente. */
export function ajustarEnPagina(
  anchoHoja: number,
  altoHoja: number,
  anchoPagina: number,
  altoPagina: number,
  margen: number,
): Caja {
  const escala = Math.min(
    (anchoPagina - 2 * margen) / anchoHoja,
    (altoPagina - 2 * margen) / altoHoja,
  );
  const ancho = anchoHoja * escala;
  const alto = altoHoja * escala;
  return { x: (anchoPagina - ancho) / 2, y: margen, ancho, alto };
}
