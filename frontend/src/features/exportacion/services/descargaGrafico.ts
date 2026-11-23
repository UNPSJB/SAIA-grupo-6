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
 * Antes de capturar, expande temporalmente los contenedores con `overflow`
 * (auto / scroll / hidden) para que `html-to-image` dibuje todo el contenido
 * y no solo lo que cabe en el viewport.
 *
 * Además de poner `overflow: visible`, fuerza el `width` de los contenedores
 * con scroll horizontal a `max-content` (o al ancho de su contenido si es
 * mayor), para que gráficos muy anchos (p. ej. el grafo de trazabilidad
 * completa de un lote) no queden recortados por el ancho de la pantalla.
 *
 * Devuelve una función para restaurar los estilos originales tras la captura.
 */
function expandirOverflow(nodo: HTMLElement): () => void {
  const restauraciones: Array<{
    elemento: HTMLElement;
    overflow: string;
    overflowX: string;
    overflowY: string;
    width: string;
    minWidth: string;
    maxWidth: string;
  }> = [];

  const recorrer = (el: HTMLElement) => {
    const estilo = getComputedStyle(el);
    const oculta =
      estilo.overflow === "auto" ||
      estilo.overflow === "scroll" ||
      estilo.overflow === "hidden" ||
      estilo.overflowX === "auto" ||
      estilo.overflowX === "scroll" ||
      estilo.overflowX === "hidden" ||
      estilo.overflowY === "auto" ||
      estilo.overflowY === "scroll" ||
      estilo.overflowY === "hidden";

    if (oculta) {
      const anchoContenido = el.scrollWidth;
      const anchoActual = el.clientWidth;

      restauraciones.push({
        elemento: el,
        overflow: estilo.overflow,
        overflowX: estilo.overflowX,
        overflowY: estilo.overflowY,
        width: el.style.width,
        minWidth: el.style.minWidth,
        maxWidth: el.style.maxWidth,
      });

      el.style.overflow = "visible";
      el.style.overflowX = "visible";
      el.style.overflowY = "visible";
      // Que el contenedor se estire al ancho del contenido, no al de la pantalla.
      el.style.width = "max-content";
      el.style.minWidth = "0";
      el.style.maxWidth = "none";
      // Si el contenido es más ancho que lo que se ve, asegurar que haya espacio.
      if (anchoContenido > anchoActual) {
        el.style.minWidth = `${anchoContenido}px`;
      }
    }

    el.childNodes.forEach((hijo) => {
      if (hijo instanceof HTMLElement) recorrer(hijo);
    });
  };

  recorrer(nodo);

  return () => {
    for (const r of restauraciones) {
      r.elemento.style.overflow = r.overflow;
      r.elemento.style.overflowX = r.overflowX;
      r.elemento.style.overflowY = r.overflowY;
      r.elemento.style.width = r.width;
      r.elemento.style.minWidth = r.minWidth;
      r.elemento.style.maxWidth = r.maxWidth;
    }
  };
}

async function capturarNodo(nodo: HTMLElement): Promise<HTMLImageElement> {
  const { toPng } = await import("html-to-image");
  const restaurarOverflow = expandirOverflow(nodo);
  // El nodo raíz (la tarjeta) también puede tener un ancho limitado por el
  // layout de la página. Forzarlo a max-content para que no recorte el grafo.
  const anchoRaiz = nodo.style.width;
  const maxAnchoRaiz = nodo.style.maxWidth;
  nodo.style.width = "max-content";
  nodo.style.maxWidth = "none";
  try {
    const dataUrl = await toPng(nodo, {
      pixelRatio: ESCALA,
      cacheBust: true,
      backgroundColor: fondoDe(nodo),
      filter: (elemento) => !(elemento instanceof HTMLElement && elemento.hasAttribute(ATRIBUTO_NO_EXPORTAR)),
    });
    return cargarImagen(dataUrl);
  } finally {
    nodo.style.width = anchoRaiz;
    nodo.style.maxWidth = maxAnchoRaiz;
    restaurarOverflow();
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
