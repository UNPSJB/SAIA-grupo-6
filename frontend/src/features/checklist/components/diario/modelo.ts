/**
 * Lógica pura del checklist diario: agrupar las tareas por plan/equipo,
 * calcular el estado de cada grupo y filtrar del lado del cliente sobre las
 * tareas ya cargadas. No llama a la API ni cambia la estructura de datos.
 */
import type { User } from "../../../../common/context/auth-context";
import { TIPOS_TAREA } from "../../../planLimpieza/types/planLimpieza";
import type { TareaDelDia } from "../../types/checklist";

/* ───────────────────────────── Grupos ───────────────────────────── */

export interface GrupoPlan {
  key: string;
  planNombre: string;
  equipoNombre: string;
  tareas: TareaDelDia[];
}

export function agruparPorPlan(tareas: TareaDelDia[]): GrupoPlan[] {
  const grupos = new Map<string, GrupoPlan>();
  for (const tarea of tareas) {
    const key = `${tarea.equipo_id}-${tarea.plan_id ?? "sin-plan"}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        key,
        planNombre: tarea.plan_nombre,
        equipoNombre: tarea.equipo_nombre,
        tareas: [],
      });
    }
    grupos.get(key)!.tareas.push(tarea);
  }
  return Array.from(grupos.values());
}

/**
 * Estado de un plan del día:
 *   completo     todas las tareas hechas                    verde esmeralda
 *   en_progreso  hay tareas hechas y quedan pendientes      azul/cyan
 *   demorado     quedan tareas y la fecha ya pasó           ámbar
 *   pendiente    ninguna hecha todavía (hoy o vista previa) gris
 */
export type EstadoGrupo = "completo" | "en_progreso" | "demorado" | "pendiente";

export function estadoGrupo(grupo: GrupoPlan, fecha: string, hoy: string): EstadoGrupo {
  const hechas = grupo.tareas.filter((t) => t.completado).length;
  if (hechas === grupo.tareas.length) return "completo";
  if (fecha < hoy) return "demorado";
  return hechas > 0 ? "en_progreso" : "pendiente";
}

/* ─────────────────────────── Tareas ─────────────────────────── */

export const esTareaCerrada = (t: TareaDelDia) => t.checklist_estado === "cerrado" || t.registro_id === 0;

export function etiquetaEtapa(tipo: string): string {
  return TIPOS_TAREA.find((opcion) => opcion.value === tipo)?.label ?? tipo;
}

/** Quién tiene la tarea a cargo hoy: el suplente si lo hay, si no el asignado. */
export function responsable(t: TareaDelDia): string | null {
  return t.reemplazado_por_nombre ?? t.operador_nombre ?? null;
}

/**
 * Nombre de quien la completó. La API del día trae el `usuario_id`, no el
 * nombre: se resuelve con los nombres que sí trae la tarea (asignado y
 * suplente) o con la sesión actual. Si no coincide con ninguno, `null`.
 */
export function completadaPor(t: TareaDelDia, usuario: User | null): string | null {
  if (t.usuario_id == null) return null;
  if (t.usuario_id === usuario?.id) return "vos";
  if (t.usuario_id === t.reemplazado_por_id) return t.reemplazado_por_nombre ?? null;
  if (t.usuario_id === t.operador_id) return t.operador_nombre ?? null;
  return null;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/* ─────────────────────────── Filtros ─────────────────────────── */

export type FiltroEstado = "todas" | "pendientes" | "completadas";

export interface FiltrosChecklist {
  texto: string;
  /** Nombre del operador responsable, `"__sin__"` para las sin asignar, o vacío. */
  operador: string;
  estado: FiltroEstado;
  etapa: string;
  misTareas: boolean;
}

export const FILTROS_INICIALES: FiltrosChecklist = {
  texto: "",
  operador: "",
  estado: "todas",
  etapa: "",
  misTareas: false,
};

export const SIN_ASIGNAR = "__sin__";

export function hayFiltrosActivos(f: FiltrosChecklist): boolean {
  return (
    f.texto.trim() !== "" || f.operador !== "" || f.estado !== "todas" || f.etapa !== "" || f.misTareas
  );
}

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function esMiTarea(t: TareaDelDia, usuario: User | null): boolean {
  if (!usuario) return false;
  return t.operador_id === usuario.id || t.reemplazado_por_id === usuario.id;
}

export function cumpleFiltros(
  t: TareaDelDia,
  grupo: GrupoPlan,
  f: FiltrosChecklist,
  usuario: User | null,
): boolean {
  const texto = normalizar(f.texto);
  if (
    texto &&
    ![t.nombre, grupo.planNombre, grupo.equipoNombre].some((campo) => normalizar(campo).includes(texto))
  ) {
    return false;
  }
  if (f.operador === SIN_ASIGNAR && responsable(t) !== null) return false;
  if (f.operador && f.operador !== SIN_ASIGNAR && responsable(t) !== f.operador) return false;
  if (f.estado === "pendientes" && t.completado) return false;
  if (f.estado === "completadas" && !t.completado) return false;
  if (f.etapa && t.tipo !== f.etapa) return false;
  if (f.misTareas && !esMiTarea(t, usuario)) return false;
  return true;
}

/** Operadores que aparecen en las tareas del día, para el filtro. */
export function operadoresDelDia(tareas: TareaDelDia[]): string[] {
  const nombres = new Set<string>();
  tareas.forEach((t) => {
    const r = responsable(t);
    if (r) nombres.add(r);
  });
  return [...nombres].sort((a, b) => a.localeCompare(b));
}

/* ─────────────────────── Registro de consumos ─────────────────────── */

/** Una fila de producto químico mientras se completa (texto, como los inputs). */
export interface FilaConsumo {
  /** Clave estable de la fila (no el producto: puede cambiarse). */
  clave: number;
  insumoId: string;
  cantidad: string;
}

let siguienteClave = 1;
export const filaConsumoVacia = (insumoId = "", cantidad = ""): FilaConsumo => ({
  clave: siguienteClave++,
  insumoId,
  cantidad,
});
