export interface CondicionConservacion {
  temperatura_aplicable?: boolean;
  temperatura_minima?: number | string | null;
  temperatura_maxima?: number | string | null;
  duracion_aplicable?: boolean;
  duracion?: number | string | null;
  unidad_duracion?: "horas" | "dias" | "meses" | null;
  instrucciones?: string | null;
}
export interface Conservacion extends CondicionConservacion {
  despues_abrir_aplicable?: boolean;
  despues_abrir?: CondicionConservacion | null;
}
export interface Marca { codigo: string; forma: "directa" | "derivado" }
export interface PerfilDeclaracion {
  evaluacion: "sin_evaluar" | "incompleta" | "evaluada";
  gluten: "desconocido" | "presente" | "ausencia_declarada";
  marcas: Marca[];
  respaldo?: string | null;
  observaciones?: string | null;
}
export interface Sustancia { codigo: string; nombre: string; condicionada: boolean }
export interface Cruzada { codigo: string; fundamento: string; respaldo?: string | null }
export interface Evaluacion { codigo: string; declarar: boolean; fundamento: string; respaldo: string }
export interface PropuestaDeclaraciones {
  version_receta_id: number | null;
  reglas: string;
  fuentes: { insumo_id: number; nombre: string; clasificacion: string; perfil: PerfilDeclaracion }[];
  detectados: { codigo: string; nombre: string; fuentes: { insumo_id: number; nombre: string; forma: string }[] }[];
  gluten: "presente" | "informacion_insuficiente" | "sin_presencia_declarada";
  pendientes_origen: string[];
  conservacion: Conservacion | null;
  conservacion_origen: "producto" | "manual";
  contaminacion_cruzada: Cruzada[];
  evaluaciones: Evaluacion[];
}
export interface DeclaracionesOut {
  revision: number;
  estado: "sugerida" | "confirmada";
  vigencia: "vigente" | "desactualizada";
  contenido: PropuestaDeclaraciones | null;
  pendientes: string[];
  confirmado_por_id: number | null;
  confirmado_por_nombre: string | null;
  confirmado_en: string | null;
  declaracion: string;
  declaracion_cruzada: string;
}
