import { obtenerCabecera, textoCabecera } from "./cabeceraExportacion";
import {
  MARGEN,
  ajustarEnPagina,
  disenarHoja,
  textoRango,
  type Diseno,
} from "./hojaGrafico";
import {
  nombreArchivoGrafico,
  type FormatoDescarga,
  type RangoGrafico,
} from "./nombreArchivoGrafico";

/** Nitidez de la imagen: se captura al doble del tamaño que se ve en pantalla. */
const ESCALA = 2;
/** Los elementos con este atributo (el botón de descarga, los selectores de fecha) no salen en la imagen. */
export const ATRIBUTO_NO_EXPORTAR = "data-no-exportar";

export interface OpcionesDescarga {
  /** Texto que se escribe dentro del archivo y arma su nombre. */
  titulo: string;
  /** Período que muestra el gráfico. Sin período, se escribe la fecha de hoy. */
  rango?: RangoGrafico | null;
}

/**
 * Descarga como PNG o PDF el gráfico que está dentro de `nodo`, con la cabecera, el título y el
 * período arriba. Todo se arma en el navegador: la imagen es la que se ve en pantalla.
 *
 * Los paquetes pesados (`html-to-image` y `jspdf`) se cargan recién cuando alguien descarga,
 * para no agrandar la carga inicial del tablero.
 */
export async function descargarGrafico(
  nodo: HTMLElement,
  formato: FormatoDescarga,
  { titulo, rango }: OpcionesDescarga,
): Promise<void> {
  const cabecera = await obtenerCabecera();
  const captura = await capturarNodo(nodo);
  const logo = cabecera.logo ? await cargarImagen(cabecera.logo).catch(() => null) : null;
  // Que la tipografía ya esté cargada: si no, el canvas escribe con otra y se corre el texto.
  await document.fonts?.ready;

  const lienzo = document.createElement("canvas");
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("El navegador no permite armar la imagen");

  const anchoImagen = captura.naturalWidth / ESCALA;
  const altoImagen = captura.naturalHeight / ESCALA;
  const diseno = disenarHoja(
    {
      anchoImagen,
      altoImagen,
      titulo,
      textoRango: textoRango(rango),
      cabecera: textoCabecera(cabecera),
      logo: logo ? { ancho: logo.naturalWidth, alto: logo.naturalHeight } : null,
    },
    (texto, fuente) => {
      contexto.font = fuente;
      return contexto.measureText(texto).width;
    },
  );

  lienzo.width = Math.ceil(diseno.ancho * ESCALA);
  lienzo.height = Math.ceil(diseno.alto * ESCALA);
  dibujarHoja(lienzo, diseno, captura, logo);

  const nombre = nombreArchivoGrafico(titulo, formato, { rango });
  if (formato === "png") {
    await descargarPng(lienzo, nombre);
  } else {
    await descargarPdf(lienzo, diseno, nombre);
  }
}

/**
 * Antes de capturar, ensancha temporalmente los contenedores con scroll horizontal
 * cuyo contenido no entra (p. ej. el grafo de trazabilidad completa de un lote),
 * para que `html-to-image` dibuje todo y no solo la parte visible.
 *
 * Solo toca lo que de verdad desborda: forzar `max-content` en todo hacía que la
 * tarjeta se achicara al ancho de sus textos y recortaba los gráficos de Recharts,
 * cuyo SVG tiene un ancho fijo en píxeles. Los `overflow: hidden` no se tocan: son
 * recortes a propósito (textos truncados, esquinas redondeadas).
 *
 * Devuelve una función para restaurar los estilos originales tras la captura.
 */
function expandirOverflow(nodo: HTMLElement): () => void {
  const restauraciones: Array<{ elemento: HTMLElement; overflowX: string; minWidth: string }> = [];

  const ensanchar = (el: HTMLElement) => {
    restauraciones.push({ elemento: el, overflowX: el.style.overflowX, minWidth: el.style.minWidth });
    el.style.minWidth = `${el.scrollWidth}px`;
    el.style.overflowX = "visible";
  };

  // Primero los de adentro: al ensancharlos, crece el contenido de los de afuera.
  const recorrer = (el: HTMLElement) => {
    for (const hijo of el.children) {
      if (hijo instanceof HTMLElement) recorrer(hijo);
    }
    const { overflowX } = getComputedStyle(el);
    const conScroll = overflowX === "auto" || overflowX === "scroll";
    if (conScroll && el.scrollWidth > el.clientWidth + 1) ensanchar(el);
  };

  recorrer(nodo);
  // La tarjeta misma puede quedar más angosta que lo que ahora contiene.
  if (nodo.scrollWidth > nodo.clientWidth + 1) ensanchar(nodo);

  return () => {
    for (const r of restauraciones.reverse()) {
      r.elemento.style.overflowX = r.overflowX;
      r.elemento.style.minWidth = r.minWidth;
    }
  };
}

/**
 * Saca de la tarjeta lo que no se exporta (título, controles, botones) y la recorta
 * hasta donde llega lo dibujado. Si no, en un tablero la tarjeta conserva el alto
 * de su fila de la grilla y la imagen sale con un hueco vacío abajo.
 *
 * No se usa `height: auto`: los gráficos con `height="100%"` (el radar del
 * comparativo) se achicarían y su SVG quedaría cortado. Se mide el borde inferior
 * de lo que se ve (SVG, imágenes y elementos sin hijos), que no cambia al ocultar.
 */
function ajustarAlContenido(nodo: HTMLElement): () => void {
  const ocultos = [...nodo.querySelectorAll<HTMLElement>(`[${ATRIBUTO_NO_EXPORTAR}]`)].map((el) => {
    const display = el.style.display;
    el.style.display = "none";
    return () => { el.style.display = display; };
  });
  const restaurarOcultos = () => ocultos.forEach((restaurar) => restaurar());

  const caja = nodo.getBoundingClientRect();
  let fondo = caja.top;
  const medir = (el: Element) => {
    const esHoja = el instanceof SVGSVGElement || el instanceof HTMLImageElement
      || el instanceof HTMLCanvasElement || el.children.length === 0;
    if (esHoja) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) fondo = Math.max(fondo, r.bottom);
      return;
    }
    for (const hijo of el.children) medir(hijo);
  };
  for (const hijo of nodo.children) medir(hijo);

  const rellenoAbajo = parseFloat(getComputedStyle(nodo).paddingBottom) || 0;
  const alto = Math.ceil(fondo - caja.top + rellenoAbajo);
  if (alto >= caja.height - 1) return restaurarOcultos;

  const { height, minHeight, alignSelf } = nodo.style;
  nodo.style.height = `${alto}px`;
  nodo.style.minHeight = "0";
  nodo.style.alignSelf = "start";
  return () => {
    nodo.style.height = height;
    nodo.style.minHeight = minHeight;
    nodo.style.alignSelf = alignSelf;
    restaurarOcultos();
  };
}

async function capturarNodo(nodo: HTMLElement): Promise<HTMLImageElement> {
  const { toPng } = await import("html-to-image");
  const restaurarAlto = ajustarAlContenido(nodo);
  const restaurarOverflow = expandirOverflow(nodo);
  try {
    const dataUrl = await toPng(nodo, {
      pixelRatio: ESCALA,
      cacheBust: true,
      backgroundColor: fondoDe(nodo),
      filter: (elemento) => !(elemento instanceof HTMLElement && elemento.hasAttribute(ATRIBUTO_NO_EXPORTAR)),
    });
    return cargarImagen(dataUrl);
  } finally {
    restaurarOverflow();
    restaurarAlto();
  }
}

/** Color de fondo con el que se ve el gráfico, para que en modo oscuro no quede texto claro sobre blanco. */
function fondoDe(nodo: HTMLElement): string {
  let actual: HTMLElement | null = nodo;
  while (actual) {
    const color = getComputedStyle(actual).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
    actual = actual.parentElement;
  }
  return "#ffffff";
}

function cargarImagen(origen: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("No se pudo cargar la imagen"));
    imagen.src = origen;
  });
}

function dibujarHoja(
  lienzo: HTMLCanvasElement,
  diseno: Diseno,
  captura: HTMLImageElement,
  logo: HTMLImageElement | null,
): void {
  const c = lienzo.getContext("2d")!;
  c.scale(ESCALA, ESCALA);
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, diseno.ancho, diseno.alto);

  if (logo && diseno.logo) {
    c.drawImage(logo, diseno.logo.x, diseno.logo.y, diseno.logo.ancho, diseno.logo.alto);
  }

  c.textBaseline = "top";
  for (const renglon of diseno.renglones) {
    c.font = renglon.fuente;
    c.fillStyle = renglon.color;
    c.fillText(renglon.texto, renglon.x, renglon.y);
  }

  c.strokeStyle = "#009b8f";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(MARGEN, diseno.lineaY);
  c.lineTo(diseno.ancho - MARGEN, diseno.lineaY);
  c.stroke();

  c.drawImage(captura, diseno.imagen.x, diseno.imagen.y, diseno.imagen.ancho, diseno.imagen.alto);
}

async function descargarPng(lienzo: HTMLCanvasElement, nombre: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/png"));
  if (!blob) throw new Error("No se pudo generar el PNG");
  bajarArchivo(blob, nombre);
}

async function descargarPdf(lienzo: HTMLCanvasElement, diseno: Diseno, nombre: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const horizontal = diseno.ancho >= diseno.alto;
  const pdf = new jsPDF({
    orientation: horizontal ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const caja = ajustarEnPagina(
    diseno.ancho,
    diseno.alto,
    pdf.internal.pageSize.getWidth(),
    pdf.internal.pageSize.getHeight(),
    10,
  );
  pdf.addImage(lienzo.toDataURL("image/png"), "PNG", caja.x, caja.y, caja.ancho, caja.alto);
  pdf.save(nombre);
}

function bajarArchivo(blob: Blob, nombre: string): void {
  const enlace = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = enlace;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(enlace);
}
