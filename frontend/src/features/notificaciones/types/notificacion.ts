export type NivelNotificacion = "VENCIDO" | "PROXIMO_A_VENCER" | "STOCK_BAJO";

export interface Notificacion { 
    id_notificacion: string; 
    tipo: string; 
    entidad_id: number; 
    titulo: string; 
    mensaje: string; 
    nivel: NivelNotificacion;
    link_destino: string; 
    fecha_referencia?: string;
    leida?: boolean;
}

/**
 * Etiqueta del nivel de la alerta.
 *
 * Vive acá y no en cada vista: el centro de notificaciones y el panel de
 * inicio muestran las mismas alertas y cada uno con su propio texto
 * terminaba diciendo una cosa distinta.
 */
export function nivelLabel(nivel: NivelNotificacion): string {
    switch (nivel) {
        case "VENCIDO":
            return "VENCIDO";
        case "PROXIMO_A_VENCER":
            return "PRÓXIMO A VENCER";
        case "STOCK_BAJO":
            return "STOCK BAJO";
    }
}


export type Criticidad = "alta" | "media" | "baja";

/** Nivel de un puntaje de riesgo. `sin_riesgo`: no hay situaciones presentes. */
export type NivelRiesgo = "alto" | "medio" | "bajo" | "sin_riesgo";

/** Riesgo máximo posible (impacto 3 × probabilidad 3). */
export const RIESGO_MAXIMO = 9;

/**
 * Nivel de un puntaje de riesgo, con los mismos rangos que el backend
 * (`riesgo.nivel_de`): bajo hasta 3, medio hasta 6, alto hasta 9.
 */
export function nivelDePuntaje(puntaje: number): NivelRiesgo {
  if (puntaje <= 0) return "sin_riesgo";
  if (puntaje <= 3) return "bajo";
  if (puntaje <= 6) return "medio";
  return "alto";
}

/** Un decimal y coma, como se muestra en toda la app: 4,8. */
export function formatoPuntaje(puntaje: number): string {
  return puntaje.toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export type IconoCriticidad =
  | "limpieza"
  | "calibracion"
  | "stock"
  | "incidente"
  | "personal"
  | "documento"
  | "checklist";

export interface AlertaCriticidad {
  clave: string;
  origen: string;
  entidad_id: number;
  grupo_clave: string;
  icono: IconoCriticidad;
  titulo: string;
  detalle: string;
  criticidad: Criticidad;
  motivo: string;
  plazo: string;
  fecha_referencia?: string;
  destino: string;
  recambio_id: number | null;
  leida?: boolean;

  /** Impacto del tipo de situación: 1 bajo, 2 medio, 3 alto. */
  impacto: number;
  /** 1 a 3: cuántas veces se detectó el mismo tipo en el mismo elemento. */
  recurrencia: number;
  /** 1 a 3: cuánto lleva presente sin resolverse. */
  persistencia: number;
  probabilidad: number;
  /** Riesgo individual (impacto × probabilidad), de 1 a 9. 0: se notifica pero
   *  no entra en el cálculo de riesgo (retiros de lote, reclamos de clientes). */
  puntaje: number;
  /** Riesgo consolidado del elemento al que pertenece la situación. */
  puntaje_elemento: number;
  /** Desde cuándo está presente. */
  detectada_en?: string;

  /** Plan de acción verificado que tiene esta situación bajo control (el motor
   *  sigue calculando su riesgo real; solo deja de sumar en el tratado). */
  plan_tratamiento_id: number | null;
  /** Riesgo de la situación descontando el plan: 0 si está controlada. */
  puntaje_tratado: number;
  /** Riesgo consolidado del elemento descontando lo controlado. */
  puntaje_elemento_tratado: number;

  /** Plan activo (sin verificar todavía) que ya trata esta situación. */
  plan_activo_id?: number | null;
  /** Su tipo exige plan desde la primera detección (lo configura el administrador). */
  exige_plan?: boolean;
  /** Necesita un plan de acción y todavía no lo tiene: "tipo" (su tipo lo
   *  exige) o "elemento" (su elemento está en riesgo alto). */
  motivo_plan?: MotivoPlan | null;
  requiere_plan?: boolean;
}

export type MotivoPlan = "tipo" | "elemento";

/** Por qué una situación exige un plan de acción, para mostrar. */
export const TEXTO_MOTIVO_PLAN: Record<MotivoPlan, string> = {
  tipo: "Este tipo de evento exige un plan de acción",
  elemento: "El elemento está en riesgo alto: exige un plan de acción",
};

/** Riesgo general de un elemento, a partir de todas sus situaciones presentes. */
export interface ResumenElemento {
  elemento: string;
  etiqueta: string;
  situaciones: number;
  puntaje: number;
  nivel: NivelRiesgo;
  /** Riesgo del elemento sin las situaciones que un plan tiene bajo control. */
  puntaje_tratado: number;
  nivel_tratado: NivelRiesgo;
  /** true si el elemento tiene situaciones bajo control de un plan. */
  en_tratamiento: boolean;
  /** Riesgo de lo que queda sin ningún plan (ni activo ni verificado). */
  puntaje_sin_plan?: number;
  /** Está en riesgo alto y lo que queda sin plan sigue siendo alto. */
  requiere_plan?: boolean;
}

export interface CriticidadDashboard {
  /** Nivel del elemento en peor situación. */
  nivel_riesgo: NivelRiesgo;
  /** Riesgo consolidado más alto entre los elementos (0 si no hay situaciones). */
  puntaje_maximo: number;
  total: number;
  altas: number;
  medias: number;
  bajas: number;
  no_leidas?: number;
  alertas: AlertaCriticidad[];
  elementos: ResumenElemento[];

  /** Nivel general descontando lo que los planes verificados controlan. */
  nivel_riesgo_tratado: NivelRiesgo;
  puntaje_maximo_tratado: number;
  altas_tratadas: number;
  medias_tratadas: number;
  bajas_tratadas: number;

  /** Situaciones que necesitan un plan de acción y todavía no lo tienen. */
  planes_requeridos?: number;
  /** Elementos en riesgo alto sin un plan que alcance para bajarlo. */
  elementos_alto_sin_plan?: number;
}
