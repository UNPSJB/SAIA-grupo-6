import {
  TIPOS_INCIDENTE,
  tipoLabel,
  type EstadoIncidente,
  type Incidente,
  type TipoIncidente,
} from "../../incidente/types/incidente";
import type { Equipo } from "../../equipo/types/equipo";
import type { PlanCalibracionMantenimiento } from "../../planCalibracionMantenimiento/types/planCalibracionMantenimiento";
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

/** Qué incidentes cuenta la torta: todos, solo abiertos o solo cerrados. */
export type FiltroEstado = "todos" | EstadoIncidente;

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
 * Color de cada porción.
 *
 * Son tonos de una misma gama azul-verdosa, como en el panel de referencia, y
 * no los colores semánticos del `Badge` de tipo (`tipoColor`): la torta se lee
 * por la etiqueta que lleva cada porción, no por el color, así que no hace
 * falta que coincida con el listado de incidentes. Si se prefiere que coincida,
 * se vuelve a mapear con `tipoColor` como estaba antes.
 *
 * Van como hexadecimal y no como variable de Chakra porque `blue` y `teal`
 * intermedios no están en el tema.
 */
const COLOR_TORTA: Record<TipoIncidente, string> = {
  falla_equipo: "#2f7378",
  higiene_contaminacion: "#4a87af",
  devolucion_cliente: "#7ba4cf",
  plagas: "#5bb0b0",
  otro: "#9aa5b1",
};

/** Nombre corto de cada tipo: las etiquetas del gráfico van al costado del anillo. */
const ETIQUETA_CORTA: Record<TipoIncidente, string> = {
  plagas: "Plagas",
  falla_equipo: "Falla Equipo",
  devolucion_cliente: "Devolución",
  higiene_contaminacion: "Higiene",
  otro: "Otro",
};

/**
 * Porcentaje de incidentes por categoría, listo para la torta.
 *
 * El filtro de estado se aplica acá y no en el request: la pantalla pide la
 * lista una sola vez y cambiar de "abiertos" a "cerrados" es instantáneo.
 *
 * El orden es el de `TIPOS_INCIDENTE` (el del formulario de reporte), no el
 * del primer incidente que llegó, así la torta no salta entre recargas. Las
 * categorías en cero no entran: una porción de 0% es ruido en el gráfico.
 */
export function partesPorTipo(
  incidentes: Incidente[],
  filtro: FiltroEstado = "todos"
): ParteTorta[] {
  const considerados =
    filtro === "todos" ? incidentes : incidentes.filter((i) => i.estado === filtro);

  const total = considerados.length;
  if (total === 0) return [];

  return TIPOS_INCIDENTE.map(({ value }) => {
    const cantidad = considerados.filter((i) => i.tipo === value).length;

    return {
      tipo: value,
      etiqueta: tipoLabel(value),
      etiquetaCorta: ETIQUETA_CORTA[value],
      color: COLOR_TORTA[value],
      cantidad,
      // Entero: la torta muestra porciones, no centésimas.
      porcentaje: Math.round((cantidad / total) * 100),
    };
  }).filter((parte) => parte.cantidad > 0);
}

/* ─────────────────────── Equipos calibrados ─────────────────────── */

export interface EstadoCalibracion {
  /** Equipos activos del laboratorio. */
  total: number;
  /** De esos, los que tienen su calibración vigente. */
  aptos: number;
  /** Nombres de los que no están aptos, para nombrarlos en la tarjeta. */
  pendientes: string[];
}

/**
 * Qué equipos están aptos para operar.
 *
 * "Apto" = tiene al menos un plan de calibración/mantenimiento **vigente**
 * (`dias_restantes > 0`). Un equipo sin plan cuenta como pendiente: no hay
 * evidencia de que esté calibrado, que es distinto de estarlo y que la app no
 * puede afirmar.
 *
 * Un equipo puede tener más de un plan (calibración y mantenimiento): es apto
 * solo si **todos** los suyos están vigentes, así que de sus planes gana el que
 * vence antes.
 */
export function calcularEquiposCalibrados(
  equipos: Equipo[],
  planes: PlanCalibracionMantenimiento[]
): EstadoCalibracion {
  const diasPorEquipo = new Map<number, number>();

  for (const plan of planes) {
    const previo = diasPorEquipo.get(plan.equipo_id);
    diasPorEquipo.set(
      plan.equipo_id,
      previo === undefined ? plan.dias_restantes : Math.min(previo, plan.dias_restantes)
    );
  }

  const activos = equipos.filter((equipo) => equipo.activo);
  const pendientes = activos
    .filter((equipo) => (diasPorEquipo.get(equipo.id) ?? -1) <= 0)
    .map((equipo) => equipo.nombre);

  return { total: activos.length, aptos: activos.length - pendientes.length, pendientes };
}

/* ────────────────── Incidentes iniciados vs resueltos ────────────────── */

export interface PuntoSerie {
  /** Etiqueta corta del eje: "Ene", "Feb"... */
  etiqueta: string;
  /** `YYYY-MM`, para la clave del tooltip. */
  clave: string;
  iniciados: number;
  resueltos: number;
}

const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Clave `YYYY-MM` de una fecha ISO, en hora local. */
function claveMes(iso: string): string | null {
  // "YYYY-MM-DD" a medianoche local: parseado como UTC se corre un día (mismo
  // criterio que `diasDesdeHoy`).
  const fecha = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return null;

  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Serie mensual de incidentes iniciados contra resueltos, de los últimos
 * `meses` meses (incluido el actual).
 *
 * Se cuenta por `fecha_reporte` y por `fecha_cierre`, que es lo que ya manda el
 * listado de incidentes: no hace falta un endpoint de estadísticas. Los meses
 * sin movimiento salen en cero, porque un mes vacío en el eje es información
 * (no pasó nada) y no un hueco.
 */
export function incidentesPorMes(incidentes: Incidente[], meses = 6): PuntoSerie[] {
  const hoy = new Date();
  const puntos: PuntoSerie[] = [];
  const iniciadosPorMes = new Map<string, number>();
  const resueltosPorMes = new Map<string, number>();

  for (let i = meses - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;

    puntos.push({
      clave,
      etiqueta: MESES_CORTOS[fecha.getMonth()],
      iniciados: 0,
      resueltos: 0,
    });
    iniciadosPorMes.set(clave, 0);
    resueltosPorMes.set(clave, 0);
  }

  for (const incidente of incidentes) {
    const abierto = claveMes(incidente.fecha_reporte);
    if (abierto && iniciadosPorMes.has(abierto)) {
      iniciadosPorMes.set(abierto, (iniciadosPorMes.get(abierto) ?? 0) + 1);
    }

    // Un incidente cerrado sin fecha de cierre no cuenta como resuelto en ningún
    // mes: no se sabe cuándo pasó.
    if (!incidente.fecha_cierre) continue;
    const cerrado = claveMes(incidente.fecha_cierre);
    if (cerrado && resueltosPorMes.has(cerrado)) {
      resueltosPorMes.set(cerrado, (resueltosPorMes.get(cerrado) ?? 0) + 1);
    }
  }

  return puntos.map((punto) => ({
    ...punto,
    iniciados: iniciadosPorMes.get(punto.clave) ?? 0,
    resueltos: resueltosPorMes.get(punto.clave) ?? 0,
  }));
}

/**
 * Serie semanal de incidentes iniciados contra resueltos del **mes en curso**.
 *
 * Son cuatro tramos fijos: del 1 al 7, del 8 al 14, del 15 al 21 y del 22 al
 * fin de mes (los días 29, 30 y 31 caen en la semana 4). Así el eje es siempre
 * el mismo y no depende de en qué día de la semana arranca el mes.
 *
 * Igual que `incidentesPorMes`, se cuenta por `fecha_reporte` y por
 * `fecha_cierre`. Lo que cae fuera del mes en curso no entra.
 */
export function incidentesPorSemana(
  incidentes: Incidente[],
  hoy: Date = new Date()
): PuntoSerie[] {
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  const prefijo = `${anio}-${String(mes + 1).padStart(2, "0")}`;

  const puntos: PuntoSerie[] = [1, 2, 3, 4].map((n) => ({
    clave: `${prefijo}-S${n}`,
    etiqueta: `Semana ${n}`,
    iniciados: 0,
    resueltos: 0,
  }));

  /** Índice (0 a 3) de la semana del mes en curso, o `null` si cae afuera. */
  const semanaDe = (iso: string): number | null => {
    const fecha = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return null;
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes) return null;

    return Math.min(Math.floor((fecha.getDate() - 1) / 7), 3);
  };

  for (const incidente of incidentes) {
    const abierta = semanaDe(incidente.fecha_reporte);
    if (abierta !== null) puntos[abierta].iniciados += 1;

    if (!incidente.fecha_cierre) continue;
    const cerrada = semanaDe(incidente.fecha_cierre);
    if (cerrada !== null) puntos[cerrada].resueltos += 1;
  }

  return puntos;
}