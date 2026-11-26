import type { AlertaCriticidad, NivelRiesgo } from "../../notificaciones/types/notificacion";
import { nivelDePuntaje } from "../../notificaciones/types/notificacion";

/*
 * Matriz de riesgo del inicio: cuántas situaciones abiertas hay para cada
 * combinación de impacto y probabilidad. Son los mismos dos ejes con los que
 * el motor calcula el puntaje de cada situación (impacto × probabilidad), así
 * que la matriz no inventa nada: reparte lo que ya devuelve
 * `/notificaciones/criticidad`.
 *
 * Es el riesgo TRATADO: las situaciones que un plan de acción verificado tiene
 * bajo control no se cuentan en la grilla (igual que en el banner de
 * Notificaciones); se informan aparte. Su riesgo real sigue en el motor.
 */

/** 1 bajo · 2 medio · 3 alto. Mismo valor para impacto y probabilidad. */
export type Escala = 1 | 2 | 3;

export const ESCALAS: readonly Escala[] = [1, 2, 3];

export const ETIQUETA_IMPACTO: Record<Escala, string> = {
  1: "Bajo",
  2: "Medio",
  3: "Alto",
};

/** Columnas: la probabilidad se nombra "Baja / Media / Alta". */
export const ETIQUETA_PROBABILIDAD: Record<Escala, string> = {
  1: "Baja",
  2: "Media",
  3: "Alta",
};

/** Qué valores del motor agrupa cada columna, para el texto de ayuda. */
export const RANGO_PROBABILIDAD: Record<Escala, string> = {
  1: "1,0 (primera vez, sin persistencia)",
  2: "más de 1,0 y hasta 2,0",
  3: "más de 2,0 y hasta 3,0",
};

export interface CeldaMatriz {
  impacto: Escala;
  probabilidad: Escala;
  /** Situaciones abiertas en esta combinación. */
  cantidad: number;
  /**
   * Nivel de la celda. Vacía: el de su zona (impacto × probabilidad de la
   * celda). Con situaciones: el de la más grave que contiene, porque una
   * columna agrupa probabilidades distintas (en impacto medio, la columna
   * "media" junta 2,6, que es bajo, con 3,2 a 4,0, que es medio).
   */
  nivel: NivelRiesgo;
}

export interface MatrizRiesgo {
  /** Impacto de mayor a menor (la fila de arriba es la más grave). */
  filas: { impacto: Escala; celdas: CeldaMatriz[] }[];
  /** Situaciones que entran en la matriz. */
  total: number;
  /** Situaciones que se notifican pero no tienen puntaje (tipos desactivados,
   *  reclamos o retiros con una causa que no cuenta, incidentes de otra clase). */
  sinPuntaje: number;
  /** Situaciones con puntaje que un plan verificado tiene bajo control. */
  controladas: number;
  /** Situaciones con puntaje que un plan ACTIVO (todavía sin verificar) ya
   *  trata. Se cuentan siempre; solo la matriz proyectada las saca. */
  enPlanActivo: number;
  /** Situaciones de la grilla por su nivel REAL (el de su puntaje, igual que
   *  los contadores del motor). */
  porNivel: Record<"alto" | "medio" | "bajo", number>;
  /** Elementos en riesgo alto: la suma de sus situaciones puede ser alta
   *  aunque cada una sea media (la grilla muestra situaciones sueltas). */
  elementosAlto: number;
  /** Elementos en riesgo alto sin un plan que alcance para bajarlos. */
  elementosAltoSinPlan: number;
  /** Situaciones que exigen un plan de acción y todavía no lo tienen. */
  planesRequeridos: number;
}

/**
 * Columna de una probabilidad del motor (continua, de 1 a 3). Pasa a la
 * columna 2 en cuanto supera 1,0 y a la 3 en cuanto supera 2,0: con esos
 * cortes, una situación de impacto alto y probabilidad hasta 2,0 queda en el
 * tramo medio de la escala y una por encima de 2,0 en el alto, igual que
 * `nivelDePuntaje`.
 */
export function columnaDeProbabilidad(probabilidad: number): Escala {
  const entera = Math.ceil(probabilidad - 1e-9);
  return Math.min(3, Math.max(1, entera)) as Escala;
}

/** Fila de un impacto del motor (1 a 3). */
export function escalaDeImpacto(impacto: number): Escala {
  return Math.min(3, Math.max(1, Math.round(impacto))) as Escala;
}

/** Una celda de la matriz: impacto (fila) y probabilidad (columna). */
export interface CoordenadaCelda {
  impacto: Escala;
  probabilidad: Escala;
}

/**
 * ¿La alerta cae en esta celda de la matriz TRATADA (la del Inicio)? Las que
 * no tienen puntaje y las que un plan verificado controla no están en la
 * grilla, así que tampoco se listan al abrir la celda.
 */
export function alertaEnCelda(
  alerta: Pick<AlertaCriticidad, "impacto" | "probabilidad" | "puntaje" | "plan_tratamiento_id">,
  celda: CoordenadaCelda,
): boolean {
  return (
    alerta.puntaje > 0 &&
    (alerta.plan_tratamiento_id === null || alerta.plan_tratamiento_id === undefined) &&
    escalaDeImpacto(alerta.impacto) === celda.impacto &&
    columnaDeProbabilidad(alerta.probabilidad) === celda.probabilidad
  );
}

/** Notificaciones filtradas por una celda: `/notificaciones?impacto=3&probabilidad=2`. */
export function rutaDeCelda(celda: CoordenadaCelda): string {
  return `/notificaciones?impacto=${celda.impacto}&probabilidad=${celda.probabilidad}`;
}

function escala(valor: string | null): Escala | null {
  const n = Number(valor);
  return n === 1 || n === 2 || n === 3 ? n : null;
}

/** La celda pedida en la URL de Notificaciones, o null si no hay (o no es válida). */
export function celdaDeParametros(parametros: URLSearchParams): CoordenadaCelda | null {
  const impacto = escala(parametros.get("impacto"));
  const probabilidad = escala(parametros.get("probabilidad"));
  return impacto && probabilidad ? { impacto, probabilidad } : null;
}

export interface OpcionesMatriz {
  /**
   * Cuenta también las situaciones que un plan verificado tiene bajo control.
   * Con `true` la matriz es el riesgo REAL; sin eso, el TRATADO.
   */
  incluirControladas?: boolean;
  /**
   * Saca además lo que ya está en un plan activo (borrador, en ejecución o
   * implementado): cómo quedaría el riesgo SI LOS PLANES SON EFICACES. Es una
   * estimación del mejor caso, no un resultado logrado.
   */
  excluirEnPlanActivo?: boolean;
}

type AlertaMatriz = Pick<
  AlertaCriticidad,
  "impacto" | "probabilidad" | "puntaje" | "plan_tratamiento_id" | "plan_activo_id"
>;

/** Reparte las situaciones con puntaje en la grilla de 3 × 3. */
export function calcularMatrizRiesgo(
  alertas: AlertaMatriz[],
  { incluirControladas = false, excluirEnPlanActivo = false }: OpcionesMatriz = {},
): MatrizRiesgo {
  const cuenta = new Map<string, number>();
  const peor = new Map<string, number>();
  const porNivel = { alto: 0, medio: 0, bajo: 0 };
  let total = 0;
  let sinPuntaje = 0;
  let controladas = 0;
  let enPlanActivo = 0;

  for (const alerta of alertas) {
    if (alerta.puntaje <= 0) {
      sinPuntaje += 1;
      continue;
    }
    const controlada = alerta.plan_tratamiento_id !== null && alerta.plan_tratamiento_id !== undefined;
    if (controlada) controladas += 1;
    const enPlan =
      !controlada && alerta.plan_activo_id !== null && alerta.plan_activo_id !== undefined;
    if (enPlan) enPlanActivo += 1;
    if (controlada && !incluirControladas) continue;
    if (enPlan && excluirEnPlanActivo) continue;
    const clave = `${escalaDeImpacto(alerta.impacto)}-${columnaDeProbabilidad(alerta.probabilidad)}`;
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    peor.set(clave, Math.max(peor.get(clave) ?? 0, alerta.puntaje));
    const nivel = nivelDePuntaje(alerta.puntaje);
    if (nivel !== "sin_riesgo") porNivel[nivel] += 1;
    total += 1;
  }

  const filas = [...ESCALAS].reverse().map((impacto) => ({
    impacto,
    celdas: ESCALAS.map((probabilidad) => ({
      impacto,
      probabilidad,
      cantidad: cuenta.get(`${impacto}-${probabilidad}`) ?? 0,
      nivel: nivelDePuntaje(peor.get(`${impacto}-${probabilidad}`) ?? impacto * probabilidad),
    })),
  }));

  return {
    filas,
    total,
    sinPuntaje,
    controladas,
    enPlanActivo,
    porNivel,
    elementosAlto: 0,
    elementosAltoSinPlan: 0,
    planesRequeridos: 0,
  };
}

/** Cuántas situaciones hay de cada nivel (alto, medio, bajo), por su puntaje. */
export function contarPorNivel(matriz: MatrizRiesgo): Record<"alto" | "medio" | "bajo", number> {
  return matriz.porNivel;
}

export const MATRIZ_VACIA: MatrizRiesgo = calcularMatrizRiesgo([]);

/**
 * Colores de la zona de cada celda: la escala `riesgo` del tema (teal de la
 * marca, ocre y terracota), acorde con la tonalidad de la página. Siguen al
 * modo claro y oscuro. Cada una tiene `solid`, `contrast`, `subtle`,
 * `border` y `fg`, como una paleta de Chakra.
 */
export const PALETA_ZONA: Record<NivelRiesgo, string> = {
  alto: "riesgo.alto",
  medio: "riesgo.medio",
  bajo: "riesgo.bajo",
  sin_riesgo: "gray",
};
