/** E11: tabla de información nutricional. Los decimales llegan como string. */

export type Fuente = "base_referencia" | "rotulo_proveedor" | "bibliografia" | "valor_propio";

export const FUENTES: { valor: Fuente; etiqueta: string }[] = [
  { valor: "base_referencia", etiqueta: "Base de composición (SARA 2 u otra)" },
  { valor: "rotulo_proveedor", etiqueta: "Rótulo del proveedor" },
  { valor: "bibliografia", etiqueta: "Otra bibliografía" },
  { valor: "valor_propio", etiqueta: "Valor propio" },
];

export const CLAVES_NUTRIENTES = [
  "energia",
  "carbohidratos",
  "azucares_totales",
  "azucares_anadidos",
  "proteinas",
  "grasas_totales",
  "grasas_saturadas",
  "grasas_trans",
  "fibra",
  "sodio",
] as const;
export type ClaveNutriente = (typeof CLAVES_NUTRIENTES)[number];

/** Nutrientes que se muestran con sangría (son parte del de arriba). */
export const SUBNUTRIENTES: string[] = [
  "azucares_totales",
  "azucares_anadidos",
  "grasas_saturadas",
  "grasas_trans",
];

export interface ParametroNutriente {
  clave: string;
  nombre: string;
  unidad: string;
  orden: number;
  valor_diario: string | null;
  umbral_no_significativo: string | null;
  decimales_menor_10: number;
  decimales_desde_10: number;
  /** false: la norma no le fija Valor Diario (azúcares y grasas trans). */
  admite_vd: boolean;
}

export interface ParametrosGenerales {
  mostrar_por_100: boolean;
  /** Agrega la frase «No aporta cantidades significativas de…» (texto fijo). */
  frase_no_significativo: boolean;
}

export interface Parametros {
  nutrientes: ParametroNutriente[];
  generales: ParametrosGenerales;
  /** Leyendas obligatorias: se muestran pero no se editan. */
  leyendas_fijas: { leyenda_calculo: string; leyenda_vd: string };
}

export type AlimentoReferencia = {
  id: number;
  base: string;
  codigo: string | null;
  nombre: string;
} & Record<ClaveNutriente, string | null>;

export interface ResultadoImportacion {
  base: string;
  creados: number;
  actualizados: number;
  errores: string[];
}

export interface ValorNutricional {
  nutriente: string;
  nombre: string;
  unidad: string;
  valor: string;
  fuente: Fuente;
  fuente_etiqueta: string;
  referencia: string | null;
  alimento_referencia_id: number | null;
  valor_fuente: string;
  cargado_en: string;
  cargado_por: string | null;
  modificado: boolean;
  modificado_en: string | null;
  modificado_por: string | null;
}

export interface Completitud {
  completo: boolean;
  exige_datos: boolean;
  faltantes: string[];
}

export interface DatosNutricionales {
  insumo_id: number;
  nombre: string;
  tipo: "ingrediente" | "aditivo";
  unidad: string;
  unidad_tipo: "masa" | "volumen" | "unidad" | null;
  peso_unidad_g: string | null;
  densidad_g_ml: string | null;
  aporta_energia_sodio: boolean;
  azucares_son_anadidos: boolean;
  grasas_son_anadidas: boolean;
  sodio_es_anadido: boolean;
  contiene_edulcorantes: boolean;
  contiene_cafeina: boolean;
  nutrientes_admitidos: string[];
  valores: ValorNutricional[];
  completitud: Completitud;
}

export interface ValorInput {
  nutriente: string;
  valor: string;
  fuente: Fuente;
  referencia: string | null;
  alimento_referencia_id: number | null;
}

export interface DatosNutricionalesInput {
  peso_unidad_g: string | null;
  densidad_g_ml: string | null;
  aporta_energia_sodio: boolean;
  azucares_son_anadidos: boolean;
  grasas_son_anadidas: boolean;
  sodio_es_anadido: boolean;
  contiene_edulcorantes: boolean;
  contiene_cafeina: boolean;
  valores: ValorInput[];
}

export interface ConfiguracionProducto {
  configurada: boolean;
  expresar_en: "g" | "ml";
  porcion: string | null;
  medida_casera: string | null;
  densidad_g_ml: string | null;
  peso_unidad_g: string | null;
}

export type ConfiguracionProductoInput = Omit<ConfiguracionProducto, "configurada">;

export interface IngredienteCalculo {
  insumo_id: number;
  nombre: string;
  tipo: "ingrediente" | "aditivo";
  cantidad: string;
  unidad: string;
  gramos: string | null;
  exige_datos: boolean;
  completo: boolean;
  faltantes: string[];
  incluido: boolean;
}

export interface FilaTabla {
  clave: string;
  nombre: string;
  unidad: string;
  por_100: string | null;
  por_porcion: string | null;
  vd: string | null;
  por_100_texto: string;
  por_porcion_texto: string;
  vd_texto: string;
  no_significativo: boolean;
  vd_establecido: boolean;
  /** Algún insumo no tiene este nutriente: la fila va sin valores. */
  faltan_datos: boolean;
  /** Sale de un análisis del producto, no de los ingredientes. */
  de_laboratorio: boolean;
}

export interface ValorLaboratorio {
  nutriente: string;
  nombre: string;
  unidad: string;
  valor_100: string;
  referencia: string | null;
  fecha_analisis: string | null;
  cargado_en: string;
  cargado_por: string | null;
}

export interface LaboratorioInput {
  referencia: string | null;
  fecha_analisis: string | null;
  valores: { nutriente: string; valor_100: string }[];
}

export type EstadoTabla = "completa" | "incompleta" | "sin_receta";

export interface InfoNutricional {
  producto_id: number;
  producto: string;
  receta_id: number | null;
  version: { id: number; numero: number; rendimiento: string; unidad: string } | null;
  configuracion: ConfiguracionProducto;
  estado: EstadoTabla;
  problemas: string[];
  ingredientes: IngredienteCalculo[];
  incompletos: IngredienteCalculo[];
  cantidad_base: string | null;
  expresar_en: "g" | "ml";
  filas: FilaTabla[];
  leyenda_calculo: string;
  leyenda_vd: string;
  leyenda_no_significativo: string | null;
  leyenda_laboratorio: string;
  mostrar_por_100: boolean;
  laboratorio: ValorLaboratorio[];
  calculado_en: string;
}
