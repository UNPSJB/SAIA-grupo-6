import type { ReclamoResumen } from "../../reclamos/types/reclamo";
import type { RetiroResumen } from "../../retiros/types/retiro";
import type { Salida } from "../../salidas/types/salida";

export type TipoIncidente =
  | "plagas"
  | "falla_equipo"
  | "higiene_contaminacion"
  | "entrega_rechazada"
  | "reclamo_cliente"
  | "retiro_lote"
  | "otro";

/**
 * Estado del incidente. Se abre al reportarlo y lo cierra el administrador
 * cuando resuelve, dejando asentada la acción correctiva.
 */
export type EstadoIncidente = "abierto" | "cerrado";

export interface Incidente {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
  equipo_nombre: string | null;
  // Vínculos opcionales con el lote / la salida / el retiro que originaron
  // el incidente. `reclamo_id` y `retiro_id` vienen solo en los listados de
  // gestión: dicen dónde se resuelve.
  lote_id: number | null;
  salida_id: number | null;
  reclamo_id: number | null;
  retiro_id: number | null;
  foto_url: string | null;
  usuario_id: number;
  usuario_nombre: string | null;
  fecha_reporte: string;
  estado: EstadoIncidente;
  fecha_cierre: string | null;
  observacion_cierre: string | null;
  responsable_cierre_id: number | null;
  responsable_cierre_nombre: string | null;
}

// --- Ficha (`GET /incidentes/{id}`) ---

/** Plan de calibración o mantenimiento vigente del equipo involucrado. */
export interface IncidentePlanEquipo {
  tipo: string;
  fecha_ultima_intervencion: string;
  proximo_vencimiento: string;
  dias_restantes: number;
}

export interface IncidenteEquipo {
  id: number;
  nombre: string;
  tipo: string;
  sector_nombre: string | null;
  activo: boolean;
  planes: IncidentePlanEquipo[];
}

export interface IncidenteLote {
  id: number;
  numero_lote: string;
  producto_nombre: string;
  unidad: string;
  estado: string;
  estado_lote: string;
  retirado: boolean;
  cantidad_producida: string | null;
  saldo: string;
  fecha_inicio: string;
  fecha_vencimiento: string | null;
}

/** Reposición de stock al cliente que salió de este incidente. */
export interface IncidenteReposicion {
  id: number;
  cliente_nombre: string;
  producto_nombre: string;
  unidad: string;
  cantidad_original: string;
  cantidad_pendiente: string;
  estado: string;
  prioridad: string;
  fecha_registro: string;
}

/** Otro incidente del mismo equipo o del mismo lote. */
export type IncidenteRelacionado = Pick<
  Incidente,
  "id" | "titulo" | "tipo" | "estado" | "fecha_reporte"
>;

/** El incidente más lo que lo rodea. Los vínculos que no tiene vienen en null. */
export interface IncidenteDetalle extends Incidente {
  equipo: IncidenteEquipo | null;
  lote: IncidenteLote | null;
  salida: Salida | null;
  reclamo: ReclamoResumen | null;
  retiro: RetiroResumen | null;
  reposiciones: IncidenteReposicion[];
  /** Los últimos; `relacionados_total` dice cuántos hay en total. */
  relacionados: IncidenteRelacionado[];
  relacionados_total: number;
}

export type IncidenteFormValues = {
  titulo: string;
  descripcion: string;
  tipo: TipoIncidente;
  equipo_id: number | null;
};

export const TIPOS_INCIDENTE: { value: TipoIncidente; label: string }[] = [
  { value: "plagas", label: "Plagas" },
  { value: "falla_equipo", label: "Falla / Rotura de Equipo" },
  { value: "higiene_contaminacion", label: "Higiene / Contaminación" },
  { value: "entrega_rechazada", label: "Entrega rechazada" },
  { value: "reclamo_cliente", label: "Reclamo de cliente" },
  { value: "retiro_lote", label: "Retiro de lote" },
  { value: "otro", label: "Otro" },
];

/**
 * Tipos que genera el sistema a partir de otra acción (un rechazo o un
 * reclamo): no se eligen en el alta manual de incidentes, porque nacen
 * vinculados a su lote/salida y se resuelven desde ese circuito.
 */
export const TIPOS_INCIDENTE_SISTEMA: TipoIncidente[] = [
  "entrega_rechazada",
  "reclamo_cliente",
  "retiro_lote",
];

/** Nace de un reclamo, un rechazo o un retiro: se resuelve ahí, no en Gestión. */
export function esDeCircuito(tipo: TipoIncidente): boolean {
  return TIPOS_INCIDENTE_SISTEMA.includes(tipo);
}

/** Tipos que sí se pueden reportar a mano. */
export const TIPOS_INCIDENTE_MANUALES: { value: TipoIncidente; label: string }[] =
  TIPOS_INCIDENTE.filter((tipo) => !esDeCircuito(tipo.value));

/** Pestaña de Gestión donde se ve cada tipo de circuito. */
const PESTANA_DE_TIPO: Partial<Record<TipoIncidente, string>> = {
  reclamo_cliente: "reclamos",
  entrega_rechazada: "rechazos",
  retiro_lote: "retiros",
};

export function pestanaDeTipo(tipo: TipoIncidente): string {
  return PESTANA_DE_TIPO[tipo] ?? "incidentes";
}

/** Tipo que se ve en una pestaña, o `""` en la de incidentes (tiene varios). */
export function tipoDePestana(pestana: string | null): TipoIncidente | "" {
  return TIPOS_INCIDENTE_SISTEMA.find((tipo) => PESTANA_DE_TIPO[tipo] === pestana) ?? "";
}

/** De dónde salió: lo reportó una persona o lo abrió otro circuito. */
export type OrigenIncidente = "reportado" | "circuito";

/** Tipos que puede tener un incidente de ese origen (todos, sin origen). */
export function tiposDeOrigen(origen: OrigenIncidente | "") {
  if (origen === "") return TIPOS_INCIDENTE;
  return TIPOS_INCIDENTE.filter(
    (tipo) => esDeCircuito(tipo.value) === (origen === "circuito")
  );
}

/** Dónde se resuelve un incidente de circuito; `null` si se cierra en Gestión. */
export function destinoResolucion(
  tipo: TipoIncidente,
  ids: { salida?: number | null; reclamo?: number | null; retiro?: number | null }
): { a: string; etiqueta: string } | null {
  if (tipo === "entrega_rechazada" && ids.salida) {
    return { a: `/salidas/${ids.salida}/detalle`, etiqueta: "Ir a resolver el rechazo" };
  }
  if (tipo === "reclamo_cliente" && ids.reclamo) {
    return { a: `/reclamos/${ids.reclamo}`, etiqueta: "Ir a cerrar el reclamo" };
  }
  if (tipo === "retiro_lote" && ids.retiro) {
    return { a: `/retiros/${ids.retiro}`, etiqueta: "Ir a cerrar el retiro" };
  }
  return null;
}

// Tipos donde tiene sentido asociar un equipo concreto. Para el resto el
// equipo queda en null y el detalle se describe en la descripción libre.
export const TIPOS_CON_EQUIPO: TipoIncidente[] = [
  "falla_equipo",
  "higiene_contaminacion",
];

export function admiteEquipo(tipo: TipoIncidente): boolean {
  return TIPOS_CON_EQUIPO.includes(tipo);
}

// Tipos donde el equipo es obligatorio. Para higiene_contaminacion el equipo
// es opcional (no siempre se contamina un equipo).
export const TIPOS_EQUIPO_OBLIGATORIO: TipoIncidente[] = ["falla_equipo"];

export function requiereEquipoObligatorio(tipo: TipoIncidente): boolean {
  return TIPOS_EQUIPO_OBLIGATORIO.includes(tipo);
}

export const ESTADOS_INCIDENTE: { value: EstadoIncidente; label: string }[] = [
  { value: "abierto", label: "Abierto" },
  { value: "cerrado", label: "Cerrado" },
];

export function estadoLabel(estado: EstadoIncidente): string {
  return ESTADOS_INCIDENTE.find((e) => e.value === estado)?.label ?? estado;
}

// --- Helpers de presentación ---
//
// Viven acá y no en cada componente porque el tipo, el estado y el formato de
// fecha se muestran en el listado, en el detalle y en los reportes del
// operador: si cada uno define el suyo, quedan desincronizados.

export function tipoLabel(tipo: TipoIncidente): string {
  return TIPOS_INCIDENTE.find((t) => t.value === tipo)?.label ?? tipo;
}

/** Paleta del badge de tipo, para que el color signifique lo mismo en todas las vistas. */
export function tipoColor(tipo: TipoIncidente): string {
  switch (tipo) {
    case "plagas": return "red";
    case "falla_equipo": return "orange";
    case "entrega_rechazada": return "pink";
    case "reclamo_cliente": return "blue";
    case "retiro_lote": return "cyan";
    case "higiene_contaminacion": return "purple";
    default: return "gray";
  }
}

const FECHA_AR = {
  timeZone: "America/Argentina/Buenos_Aires",
  hour12: false,
} as const;

export function formatoFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", FECHA_AR);
}

export function formatoFechaCierre(fecha: string | null): string {
  return fecha ? formatoFecha(fecha) : "-";
}

/** Tiempo entre dos momentos, en la unidad más grande que tenga sentido: "3 días". */
export function duracion(desde: string, hasta: string | Date = new Date()): string {
  const minutos = Math.max(
    0,
    Math.floor((new Date(hasta).getTime() - new Date(desde).getTime()) / 60_000)
  );
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  if (minutos < 60) return plural(minutos, "minuto", "minutos");
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return plural(horas, "hora", "horas");
  return plural(Math.floor(horas / 24), "día", "días");
}

// --- Historial de incidente ---

export interface HistorialIncidenteItem {
  id: number;
  estado_anterior: string;
  estado_nuevo: string;
  usuario_id: number;
  usuario_nombre: string | null;
  observacion: string | null;
  fecha_evento: string;
}

export interface HistorialIncidenteResponse {
  incidente_id: number;
  eventos: HistorialIncidenteItem[];
}

// --- Resumen por tipo (indicador E7) ---

/** Cantidad de incidentes de un tipo, tal como la devuelve el backend. */
export interface IncidenteResumenTipo {
  tipo: TipoIncidente;
  cantidad: number;
}

/**
 * Resumen de incidentes por tipo que alimenta el indicador del tablero (E7).
 *
 * `estado` indica el universo contado ("abierto" o "todos") y `total` es la
 * suma de todas las cantidades.
 */
export interface IncidenteResumen {
  estado: string;
  total: number;
  por_tipo: IncidenteResumenTipo[];
}

// --- Período seleccionable de la estadística de incidentes por tipo ---

/**
 * Período con el que se acota la estadística y el listado.
 *
 * `7d` y `30d` son los últimos 7/30 días **inclusive** (de hoy menos N días
 * hasta hoy); `mes` va del primer día del mes en curso a hoy; `todo` no
 * filtra; `personalizado` usa las fechas que elige el usuario.
 */
export type PeriodoRapido = "7d" | "30d" | "mes" | "todo" | "personalizado";

/**
 * Etiqueta corta del período, tal como se muestra en los botones del panel y
 * en el chip de filtros del listado.
 *
 * Existe aparte de `periodoLabel` porque ese devuelve una frase para meter
 * dentro de una oración ("… · este mes") y acá hace falta el rótulo suelto,
 * con mayúscula inicial, igual que el resto de los chips ("Abierto", "Tipo ↑").
 */
export const ETIQUETA_PERIODO: Record<PeriodoRapido, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  mes: "Este mes",
  todo: "Todo",
  personalizado: "Personalizado",
};

/**
 * Nombre del período para los mensajes de la interfaz.
 *
 * `personalizado` no menciona las fechas acá: el panel ya muestra el rango
 * exacto y el listado no tiene dónde repetirlo.
 */
export function periodoLabel(periodo: PeriodoRapido): string {
  switch (periodo) {
    case "7d":
      return "los últimos 7 días";
    case "30d":
      return "los últimos 30 días";
    case "mes":
      return "este mes";
    case "todo":
      return "todos los períodos";
    case "personalizado":
      return "el período seleccionado";
  }
}
