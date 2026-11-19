import {
  TIPOS_INCIDENTE,
  tipoLabel,
  type Incidente,
  type TipoIncidente,
} from "../../incidente/types/incidente";
import type { Notificacion } from "../../notificaciones/types/notificacion";
import { hoyISO } from "../../../common/utils/fechas";

/**
 * Cálculos del panel de inicio.
 *
 * El panel no pide nada nuevo a la API: reutiliza el listado de tareas del
 * día, el de incidentes, el de notificaciones, el de equipos y el de planes de
 * calibración, y arma los números acá. Por eso todo lo de este módulo son
 * funciones puras: el porcentaje, las porciones de la torta, el estado de
 * calibración y la serie mensual se pueden leer (y probar) sin tocar el render.
 */

/** Una porción de la torta. */
export interface ParteTorta {
  tipo: TipoIncidente;
  etiqueta: string;
  /** Nombre corto para rotular la porción en el gráfico ("Falla Equipo"). */
  etiquetaCorta: string;
  /** Color de la porción, como valor CSS que entiende el `stroke` del SVG. */
  color: string;
  cantidad: number;
  /** Porcentaje entero sobre el total del filtro (0 a 100). */
  porcentaje: number;
}

/** Cumplimiento de los checklists del día. */
export interface Cumplimiento {
  total: number;
  completadas: number;
  porcentaje: number;
}

/**
 * Porcentaje de tareas del día ya completadas.
 *
 * `total === 0` devuelve 0 y no `NaN`: sin tareas programadas (fin de semana,
 * plan sin tareas para la fecha) la tarjeta tiene que decir "no hay tareas",
 * no "NaN%".
 */
export function calcularCumplimiento(
  tareas: { completado: boolean }[]
): Cumplimiento {
  const total = tareas.length;
  const completadas = tareas.filter((t) => t.completado).length;
  const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100);

  return { total, completadas, porcentaje };
}

/**
 * Color de cada porción: paleta categórica de referencia, en el orden del
 * anillo (plagas, falla, devolución, higiene, otro).
 *
 * Antes eran cinco tonos de la misma gama azul-verdosa y no pasaban ninguna
 * verificación: con visión normal dos porciones vecinas apenas se
 * distinguían (ΔE 7,4, el mínimo es 15). Esta paleta pasa la separación
 * entre porciones contiguas, incluida la vuelta del anillo, para visión
 * normal (ΔE ≥ 16) y con daltonismo (ΔE ≥ 9), validada con el script del
 * skill de visualización. "Otro" va en gris a propósito: es el resto.
 *
 * El color sigue al tipo y no a su posición en el ranking: filtrar no
 * repinta las porciones. La leyenda con nombre, ícono y número acompaña
 * siempre, así el color nunca es la única forma de identificar el tipo.
 */
const COLOR_TORTA: Record<TipoIncidente, string> = {
  plagas: "#2a78d6",
  falla_equipo: "#eb6834",
  devolucion_cliente: "#1baf7a",
  higiene_contaminacion: "#eda100",
  entrega_rechazada: "#c53030",
  // Antes "Reclamo" era casi el azul de "Plagas" y "Retiro lote" el mismo
  // rojo que "Rechazo": en el anillo no se distinguían.
  reclamo_cliente: "#8e5bd0",
  retiro_lote: "#9c6b3c",
  otro: "#8a94a3",
};

/** Nombre corto de cada tipo: las etiquetas del gráfico van al costado del anillo. */
const ETIQUETA_CORTA: Record<TipoIncidente, string> = {
  plagas: "Plagas",
  falla_equipo: "Falla Equipo",
  devolucion_cliente: "Devolución",
  higiene_contaminacion: "Higiene",
  entrega_rechazada: "Rechazo",
  reclamo_cliente: "Reclamo",
  retiro_lote: "Retiro lote",
  otro: "Otro",
};

/**
 * Porcentaje de incidentes por categoría, listo para el anillo, a partir de
 * los conteos por tipo que manda el panel de Calidad.
 *
 * El orden es el de `TIPOS_INCIDENTE` (el del formulario de reporte), no el
 * que llega, así el anillo no salta entre recargas. Las categorías en cero no
 * entran: una porción de 0% es ruido en el gráfico.
 */
export function partesDeConteos(conteos: { clave: string; valor: number }[]): ParteTorta[] {
  const cantidades = new Map(conteos.map((c) => [c.clave, c.valor]));
  const total = conteos.reduce((suma, c) => suma + c.valor, 0);
  if (total === 0) return [];

  return TIPOS_INCIDENTE.map(({ value }) => {
    const cantidad = cantidades.get(value) ?? 0;

    return {
      tipo: value,
      etiqueta: tipoLabel(value),
      etiquetaCorta: ETIQUETA_CORTA[value],
      color: COLOR_TORTA[value],
      cantidad,
      // Entero: el anillo muestra porciones, no centésimas.
      porcentaje: Math.round((cantidad / total) * 100),
    };
  }).filter((parte) => parte.cantidad > 0);
}

const MS_POR_DIA = 86_400_000;

/** Días de calendario entre hoy y la fecha (negativo si ya pasó). */
export function diasDesdeHoy(fecha: string): number {
  return Math.round(
    (new Date(`${fecha}T00:00:00`).getTime() -
      new Date(`${hoyISO()}T00:00:00`).getTime()) /
      MS_POR_DIA
  );
}

/**
 * Plazo de una alerta en palabras: "hace 5 días", "vence mañana".
 *
 * El texto sale del signo de `diasDesdeHoy` y no del `nivel` que manda el
 * backend: la verdad es la fecha, y las dos pueden quedar desfasadas el día
 * que el vencimiento es hoy.
 */
export function etiquetaPlazo(notificacion: Notificacion): string {
  if (notificacion.nivel === "STOCK_BAJO") return "Requiere reposición";

  const { fecha_referencia: fecha } = notificacion;
  if (!fecha) return "Sin fecha";

  const dias = diasDesdeHoy(fecha);
  if (dias < 0) {
    const cantidad = -dias;
    return `hace ${cantidad} ${cantidad === 1 ? "día" : "días"}`;
  }
  if (dias === 0) {
    return notificacion.nivel === "VENCIDO" ? "venció hoy" : "vence hoy";
  }
  if (dias === 1) return "vence mañana";

  return `vence en ${dias} días`;
}

/**
 * Prioridad de una alerta, para el badge de "Requiere atención".
 *
 * El backend solo distingue `VENCIDO` de `PROXIMO_A_VENCER`; la prioridad
 * afina lo segundo por la cercanía del vencimiento:
 *
 *   crítico     ya venció
 *   urgente     vence en `DIAS_URGENTE` días o menos
 *   pendiente   vence en `DIAS_PENDIENTE` días o menos
 *   programada  vence más adelante
 *
 * Los dos umbrales son una decisión de la pantalla, no del backend: se cambian
 * acá sin tocar nada más.
 */
export type PrioridadAlerta = "critico" | "urgente" | "pendiente" | "programada";

const DIAS_URGENTE = 3;
const DIAS_PENDIENTE = 7;

export const PRIORIDAD_LABEL: Record<PrioridadAlerta, string> = {
  critico: "Crítico",
  urgente: "Urgente",
  pendiente: "Pendiente",
  programada: "Programada",
};

export function prioridadAlerta(notificacion: Notificacion): PrioridadAlerta {
  if (notificacion.nivel === "VENCIDO") return "critico";
  if (notificacion.nivel === "STOCK_BAJO") return "urgente";

  // Sin fecha no se puede medir la cercanía: se trata como pendiente.
  if (!notificacion.fecha_referencia) return "pendiente";

  const dias = diasDesdeHoy(notificacion.fecha_referencia);
  if (dias <= DIAS_URGENTE) return "urgente";
  if (dias <= DIAS_PENDIENTE) return "pendiente";

  return "programada";
}

/* ─────────────────────── Requiere atención ─────────────────────── */

/** Qué ícono lleva la fila: sale del origen de la alerta. */
export type IconoAlerta = "limpieza" | "calibracion" | "stock" | "incidente";

/**
 * Una fila de "Requiere atención".
 *
 * La lista mezcla dos orígenes distintos —las notificaciones de vencimientos y
 * los incidentes abiertos— y la tarjeta no tiene por qué saber de cuál viene
 * cada una: acá se normalizan a una forma común y la tarjeta solo dibuja.
 */
export interface AlertaPanel {
  /** Estable y único entre los dos orígenes (sirve de `key`). */
  clave: string;
  icono: IconoAlerta;
  titulo: string;
  detalle: string;
  prioridad: PrioridadAlerta;
  /** Plazo en palabras: "hace 5 días", "vence mañana". */
  plazo: string;
  /** Ruta a la que lleva la fila. */
  destino: string;
  /**
   * Id del elemento de limpieza cuyo recambio se puede registrar desde la fila,
   * o `null` si la alerta no admite ese botón.
   */
  recambioId: number | null;
}

const ORDEN_PRIORIDAD: Record<PrioridadAlerta, number> = {
  critico: 0,
  urgente: 1,
  pendiente: 2,
  programada: 3,
};

/** "Abierto hace 3 días", "Reportado hoy". */
function etiquetaIncidente(diasAbierto: number): string {
  if (diasAbierto <= 0) return "Reportado hoy";

  return `Abierto hace ${diasAbierto} ${diasAbierto === 1 ? "día" : "días"}`;
}

/**
 * Las `limite` filas más urgentes de "Requiere atención".
 *
 * Mezcla los vencimientos (notificaciones) con los incidentes **abiertos**, que
 * entran con prioridad "pendiente". El orden es:
 *
 *   1. por prioridad: crítico, urgente, pendiente, programada;
 *   2. dentro de la misma prioridad, lo que más tiempo lleva sin atenderse: el
 *      vencimiento más antiguo y el incidente abierto hace más días van primero.
 *
 * Una alerta sin fecha de referencia no se puede ordenar por plazo: va al
 * final de su prioridad en vez de inventar una posición.
 *
 * Un incidente cerrado ya no pide nada, así que no entra.
 */
export function alertasDelPanel(
  notificaciones: Notificacion[],
  incidentes: Incidente[],
  limite = 5
): AlertaPanel[] {
  const filas: (AlertaPanel & { orden: number })[] = [];

  for (const n of notificaciones) {
    const esLimpieza = n.tipo === "ELEMENTO_LIMPIEZA";
    const esStockBajo = n.tipo === "STOCK_BAJO";

    filas.push({
      clave: `notificacion-${n.id_notificacion}`,
      icono: esLimpieza ? "limpieza" : esStockBajo ? "stock" : "calibracion",
      titulo: n.titulo,
      detalle: n.mensaje,
      prioridad: prioridadAlerta(n),
      plazo: etiquetaPlazo(n),
      destino: n.link_destino,
      recambioId: esLimpieza ? n.entidad_id : null,
      // Los días hasta el vencimiento: negativo si ya venció, así lo más viejo
      // queda primero.
      orden: n.fecha_referencia
        ? diasDesdeHoy(n.fecha_referencia)
        : Number.POSITIVE_INFINITY,
    });
  }

  for (const i of incidentes) {
    if (i.estado !== "abierto") continue;

    // `fecha_reporte` es un ISO con hora: `diasDesdeHoy` espera solo la fecha.
    const dias = diasDesdeHoy(i.fecha_reporte.slice(0, 10));
    const equipo = i.equipo_nombre ? ` · ${i.equipo_nombre}` : "";

    filas.push({
      clave: `incidente-${i.id}`,
      icono: "incidente",
      titulo: i.titulo,
      detalle: `${tipoLabel(i.tipo)}${equipo}`,
      prioridad: "pendiente",
      plazo: etiquetaIncidente(-dias),
      destino: `/incidentes/${i.id}`,
      recambioId: null,
      orden: dias,
    });
  }

  return filas
    .sort(
      (a, b) =>
        ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
        (a.orden === b.orden ? 0 : a.orden < b.orden ? -1 : 1)
    )
    .slice(0, limite)
    .map((fila) => ({
      clave: fila.clave,
      icono: fila.icono,
      titulo: fila.titulo,
      detalle: fila.detalle,
      prioridad: fila.prioridad,
      plazo: fila.plazo,
      destino: fila.destino,
      recambioId: fila.recambioId,
    }));
}

/* ─────────────────────────── Rango de fechas ─────────────────────────── */

/** Rango de fechas `YYYY-MM-DD`, ambos extremos incluidos. */
export interface RangoFechas {
  desde: string;
  hasta: string;
}

/** "Desde" posterior a "Hasta": el rango no sirve. */
export function errorDeRangoFechas(rango: RangoFechas): string | null {
  if (!rango.desde || !rango.hasta) return "Elegí las dos fechas del período.";
  if (rango.desde > rango.hasta) return "La fecha \"desde\" no puede ser posterior a \"hasta\".";
  return null;
}
