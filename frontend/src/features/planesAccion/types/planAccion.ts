import type { TonoEstado } from "../../../components/ui/patrones";

export type EstadoPlan =
  | "borrador"
  | "en_ejecucion"
  | "implementado"
  | "en_verificacion"
  | "cerrado_eficaz"
  | "cerrado_parcial"
  | "cerrado_no_eficaz"
  | "cancelado";

export type EstadoSituacionPlan =
  | "pendiente"
  | "accion_implementada"
  | "corregida"
  | "eficaz"
  | "no_eficaz";

export type GrupoPlan = "activos" | "finalizados";

interface InfoEstado {
  value: EstadoPlan;
  label: string;
  tono: TonoEstado;
}

export const ESTADOS_PLAN: InfoEstado[] = [
  { value: "borrador", label: "Borrador", tono: "neutro" },
  { value: "en_ejecucion", label: "En ejecución", tono: "info" },
  { value: "implementado", label: "Implementado", tono: "info" },
  { value: "en_verificacion", label: "En verificación", tono: "alerta" },
  { value: "cerrado_eficaz", label: "Cerrado · eficaz", tono: "ok" },
  { value: "cerrado_parcial", label: "Cerrado · parcialmente eficaz", tono: "alerta" },
  { value: "cerrado_no_eficaz", label: "Cerrado · no eficaz", tono: "peligro" },
  { value: "cancelado", label: "Cancelado", tono: "neutro" },
];

export function estadoPlanLabel(estado: EstadoPlan): string {
  return ESTADOS_PLAN.find((e) => e.value === estado)?.label ?? estado;
}

export function estadoPlanTono(estado: EstadoPlan): TonoEstado {
  return ESTADOS_PLAN.find((e) => e.value === estado)?.tono ?? "neutro";
}

export function estaCerrado(estado: EstadoPlan): boolean {
  return (
    estado === "cerrado_eficaz" ||
    estado === "cerrado_parcial" ||
    estado === "cerrado_no_eficaz"
  );
}

const ESTADOS_SITUACION: Record<EstadoSituacionPlan, { label: string; tono: TonoEstado }> = {
  pendiente: { label: "Pendiente", tono: "neutro" },
  accion_implementada: { label: "Acción implementada", tono: "info" },
  corregida: { label: "Corregida", tono: "alerta" },
  eficaz: { label: "Eficaz", tono: "ok" },
  no_eficaz: { label: "No eficaz", tono: "peligro" },
};

export function estadoSituacionLabel(estado: EstadoSituacionPlan): string {
  return ESTADOS_SITUACION[estado]?.label ?? estado;
}

export function estadoSituacionTono(estado: EstadoSituacionPlan): TonoEstado {
  return ESTADOS_SITUACION[estado]?.tono ?? "neutro";
}

/** Los tres momentos que distingue el documento: acción, corrección y efectividad. */
export const ETIQUETA_MOMENTO_RIESGO = {
  antes: "Al crear el plan",
  implementado: "Al implementarlo",
  cierre: "Al cerrarlo",
} as const;

export type MomentoRiesgo = keyof typeof ETIQUETA_MOMENTO_RIESGO;

export interface Evidencia {
  id: number;
  tipo: "implementacion" | "verificacion";
  descripcion: string;
  archivo_url: string | null;
  nombre_archivo: string | null;
  usuario_nombre: string | null;
  fecha: string;
}

export interface AccionPlan {
  id: number;
  descripcion: string;
  responsable_id: number;
  responsable_nombre: string;
  plazo: string;
  completada_en: string | null;
  completada: boolean;
  vencida: boolean;
  evidencias: Evidencia[];
}

export interface SituacionPlan {
  id: number;
  situacion_id: number;
  estado: EstadoSituacionPlan;
  es_origen: boolean;
  tipo: string;
  elemento: string;
  titulo: string;
  detalle: string;
  detectada_en: string;
  resuelta_en: string | null;
  sigue_presente: boolean;
  verificacion_manual: boolean;
  verificada_en: string | null;
  destino: string | null;
  evidencias: Evidencia[];
}

export interface HistorialPlan {
  id: number;
  fecha: string;
  usuario_nombre: string | null;
  evento: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  detalle: string;
}

export interface RiesgoElementoPlan {
  elemento: string;
  etiqueta: string;
  momento: MomentoRiesgo;
  puntaje: number;
  nivel: string;
  fecha: string;
}

export interface PlanResumen {
  id: number;
  tipo: string;
  tipo_etiqueta: string;
  estado: EstadoPlan;
  objetivo: string;
  responsable_id: number;
  responsable_nombre: string;
  plazo: string | null;
  vencido: boolean;
  fecha_creacion: string;
  fecha_fin_observacion: string | null;
  fecha_cierre: string | null;
  acciones_total: number;
  acciones_completadas: number;
  acciones_vencidas: number;
  situaciones_total: number;
  plan_anterior_id: number | null;
}

export interface PlanDetalle extends PlanResumen {
  causa: string;
  criterio_eficacia: string;
  dias_observacion: number;
  creado_por_nombre: string;
  fecha_implementado: string | null;
  fecha_inicio_observacion: string | null;
  motivo_cancelacion: string | null;
  editable: boolean;
  cancelable: boolean;
  candidatas_nuevas: number;
  acciones: AccionPlan[];
  situaciones: SituacionPlan[];
  historial: HistorialPlan[];
  riesgos: RiesgoElementoPlan[];
  planes_vinculados: number[];
}

export interface SituacionDisponible {
  situacion_id: number;
  tipo: string;
  tipo_etiqueta: string;
  elemento: string;
  clave_alerta: string | null;
  titulo: string;
  detalle: string;
  detectada_en: string;
  criticidad: "alta" | "media" | "baja" | null;
  puntaje: number;
  recurrencia: number;
  destino: string | null;
  sugerir_plan: boolean;
}

export interface SituacionConPlan {
  clave_alerta: string;
  plan_id: number;
  plan_estado: EstadoPlan;
}

export interface ResponsablePosible {
  id: number;
  nombre: string;
}

export interface ObservacionTipo {
  tipo: string;
  etiqueta: string;
  dias: number;
  dias_por_defecto: number;
  modificado: boolean;
}

export interface AccionInput {
  descripcion: string;
  responsable_id: number;
  plazo: string;
}

export interface PlanInput {
  situacion_origen_id: number;
  causa: string;
  objetivo: string;
  criterio_eficacia: string;
  responsable_id: number;
  plazo?: string | null;
  plan_anterior_id?: number | null;
  situaciones_adicionales: number[];
  confirma_causa_compatible: boolean;
  acciones: AccionInput[];
}

export interface PlanCambios {
  causa?: string;
  objetivo?: string;
  criterio_eficacia?: string;
  responsable_id?: number;
  plazo?: string | null;
  quitar_plazo?: boolean;
}

/** Nivel de riesgo de un elemento (el mismo vocabulario que el centro de notificaciones). */
export function etiquetaNivel(nivel: string): string {
  switch (nivel) {
    case "alto":
      return "Alto";
    case "medio":
      return "Medio";
    case "bajo":
      return "Bajo";
    default:
      return "Sin riesgo";
  }
}

export function paletaNivel(nivel: string): "red" | "orange" | "green" | "gray" {
  switch (nivel) {
    case "alto":
      return "red";
    case "medio":
      return "orange";
    case "bajo":
      return "green";
    default:
      return "gray";
  }
}
