/** E12: aplicabilidad y sellos del rotulado frontal. */

export type ClaveMarca = "azucares" | "grasas" | "sodio" | "edulcorantes" | "cafeina";
export type EstadoRotulado =
  | "sin_definir"
  | "no_aplica"
  | "no_aplica_canal_industrial"
  | "exceptuado"
  | "aplica"
  | "modulo_inactivo";
export type OrigenMarca = "receta" | "correccion";
export type CanalComercializacion = "MINORISTA" | "MAYORISTA" | "MAYORISTA_INDUSTRIAL";

export const CANALES_COMERCIALIZACION: {
  valor: CanalComercializacion;
  etiqueta: string;
}[] = [
  { valor: "MINORISTA", etiqueta: "Minorista (consumo final)" },
  { valor: "MAYORISTA", etiqueta: "Mayorista" },
  { valor: "MAYORISTA_INDUSTRIAL", etiqueta: "Industrial (gastronomía o fábrica)" },
];

export const INS_EDULCORANTES_INICIAL = [
  "420",
  "421",
  "422",
  "950",
  "951",
  "952",
  "953",
  "954",
  "955",
  "956",
  "957",
  "958",
  "959",
  "960",
  "961",
  "962",
  "963",
  "964",
  "965",
  "966",
  "967",
  "968",
  "969",
];

export const INGREDIENTES_CAFEINA_INICIAL = [
  "cafe",
  "cafeina",
  "te",
  "te verde",
  "te negro",
  "te blanco",
  "guarana",
  "yerba mate",
  "mate cocido",
  "guayusa",
];

export const MARCAS_ROTULADO: {
  clave: ClaveMarca;
  nombre: string;
  ayuda: string;
}[] = [
  {
    clave: "azucares",
    nombre: "Azúcares agregados",
    ayuda: "Azúcar, miel, jarabes, dulce de leche o cualquier ingrediente con azúcar añadido.",
  },
  {
    clave: "grasas",
    nombre: "Grasas agregadas",
    ayuda: "Grasas o aceites agregados como ingrediente, no las grasas propias del alimento.",
  },
  {
    clave: "sodio",
    nombre: "Sodio agregado",
    ayuda: "Sal, sodio o aditivos que aportan sodio de forma relevante.",
  },
  {
    clave: "edulcorantes",
    nombre: "Edulcorantes",
    ayuda: "Aditivos de clase funcional edulcorante o ingredientes que los contengan.",
  },
  {
    clave: "cafeina",
    nombre: "Cafeína",
    ayuda: "Cafeína agregada o ingredientes que la aporten (café, té, guaraná).",
  },
];

export const ETIQUETA_ESTADO: Record<EstadoRotulado, string> = {
  sin_definir: "Falta definir",
  no_aplica: "No corresponde",
  no_aplica_canal_industrial: "No aplica por canal",
  exceptuado: "Exceptuado",
  aplica: "Corresponde rotular",
  modulo_inactivo: "Módulo desactivado",
};

export interface ParametroNormativo {
  clave: string;
  etiqueta: string;
  valor: number;
  unidad: string;
}

export interface AjusteModuloRotulado {
  modulo_activo: boolean;
  actualizado_en: string;
}

export const UMBRALES_SELLOS_INICIAL: ParametroNormativo[] = [
  { clave: "energia_solidos", etiqueta: "Energía en sólidos", valor: 275, unidad: "kcal/100 g" },
  { clave: "energia_liquidos", etiqueta: "Energía en líquidos", valor: 70, unidad: "kcal/100 ml" },
  { clave: "azucares_energia", etiqueta: "Azúcares agregados sobre energía", valor: 10, unidad: "% de energía" },
  { clave: "grasas_totales_energia", etiqueta: "Grasas totales sobre energía", valor: 30, unidad: "% de energía" },
  { clave: "grasas_saturadas_energia", etiqueta: "Grasas saturadas sobre energía", valor: 10, unidad: "% de energía" },
  { clave: "sodio_mg_kcal", etiqueta: "Sodio por energía", valor: 1, unidad: "mg/kcal" },
];

export const FORMULAS_NUTRICIONALES_INICIALES: ParametroNormativo[] = [
  { clave: "kcal_por_g_azucares", etiqueta: "Energía por gramo de azúcares", valor: 4, unidad: "kcal/g" },
  { clave: "kcal_por_g_grasas", etiqueta: "Energía por gramo de grasas", valor: 9, unidad: "kcal/g" },
  { clave: "kcal_por_g_grasas_saturadas", etiqueta: "Energía por gramo de grasas saturadas", valor: 9, unidad: "kcal/g" },
];

export type OperadorAplicabilidad =
  | "es_verdadero"
  | "es_falso"
  | "es_nulo"
  | "no_es_nulo"
  | "igual"
  | "distinto";

export interface CondicionAplicabilidad {
  campo: string;
  operador: OperadorAplicabilidad;
  valor?: unknown;
}

export interface CategoriaExceptuada {
  clave: string;
  etiqueta: string;
}

export interface CondicionReglaAplicabilidad {
  clave: string;
  cuando: CondicionAplicabilidad[];
  estado: EstadoRotulado;
  mensaje: string;
  faltantes?: string[];
  incluir_marcas_pendientes?: boolean;
  mensaje_extra_marcas?: string | null;
}

export interface ResultadoReglaAplicabilidad {
  clave: string;
  estado: EstadoRotulado;
  mensaje: string;
  faltantes?: string[];
  incluir_marcas_pendientes?: boolean;
  mensaje_extra_marcas?: string | null;
}

export interface ReglasAplicabilidad {
  canales_consumo_final: string[];
  categorias_exceptuadas: CategoriaExceptuada[];
  evaluar_perfil_cuando: CondicionAplicabilidad[];
  condiciones: CondicionReglaAplicabilidad[];
  resultado_por_defecto: ResultadoReglaAplicabilidad;
}

export const REGLAS_APLICABILIDAD_INICIALES: ReglasAplicabilidad = {
  canales_consumo_final: ["MINORISTA"],
  categorias_exceptuadas: [
    { clave: "azucar_comun", etiqueta: "Azúcar común" },
    { clave: "aceites_vegetales", etiqueta: "Aceites vegetales" },
    { clave: "frutos_secos", etiqueta: "Frutos secos" },
    { clave: "sal_comun", etiqueta: "Sal común de mesa" },
    { clave: "otra_exceptuada", etiqueta: "Otra categoría exceptuada" },
  ],
  resultado_por_defecto: {
    clave: "resultado_por_defecto",
    estado: "sin_definir",
    mensaje:
      "Falta definir marcas del producto antes de saber si corresponde el rotulado frontal. Falta: {marcas}.",
    faltantes: [],
    incluir_marcas_pendientes: true,
  },
  evaluar_perfil_cuando: [
    { campo: "modulo_activo", operador: "es_verdadero" },
    { campo: "canal_consumo_final", operador: "es_verdadero" },
    { campo: "categoria_exceptuada", operador: "es_falso" },
  ],
  condiciones: [
    {
      clave: "modulo_inactivo",
      cuando: [{ campo: "modulo_activo", operador: "es_falso" }],
      estado: "modulo_inactivo",
      mensaje:
        "El módulo de octógonos está desactivado. No se evalúa el rotulado frontal ni se calculan sellos; el resto del sistema sigue funcionando normalmente.",
    },
    {
      clave: "canal_no_consumo_final",
      cuando: [{ campo: "canal_consumo_final", operador: "es_falso" }],
      estado: "no_aplica_canal_industrial",
      mensaje:
        "El producto se destina a un canal que no es de consumo final directo: no se evalúa el rotulado frontal del empaque.",
    },
    {
      clave: "excepcion_por_naturaleza",
      cuando: [{ campo: "categoria_exceptuada", operador: "es_verdadero" }],
      estado: "exceptuado",
      mensaje:
        "El producto pertenece a una categoría exceptuada por el artículo 9 de la Ley 27.642: queda exceptuado del rotulado frontal.",
    },
    {
      clave: "no_envasado",
      cuando: [{ campo: "envasado", operador: "es_falso" }],
      estado: "no_aplica",
      mensaje:
        "El producto no se comercializa envasado en ausencia del cliente: no corresponde el rotulado frontal y no se calculan sellos.",
    },
    {
      clave: "falta_envasado",
      cuando: [{ campo: "envasado", operador: "es_nulo" }],
      estado: "sin_definir",
      mensaje:
        "Falta indicar si el producto se comercializa envasado en ausencia del cliente.",
      faltantes: [
        "si se comercializa envasado en ausencia del cliente",
      ],
      incluir_marcas_pendientes: true,
      mensaje_extra_marcas: "También faltan marcas: {marcas}.",
    },
    {
      clave: "alguna_marca_obligatoria",
      cuando: [{ campo: "alguna_marca_obligatoria", operador: "es_verdadero" }],
      estado: "aplica",
      mensaje:
        "El producto se comercializa envasado y presenta marcas de rotulado frontal: corresponde el rotulado frontal y se calculan sus sellos.",
    },
    {
      clave: "faltan_marcas",
      cuando: [{ campo: "hay_marcas_pendientes", operador: "es_verdadero" }],
      estado: "sin_definir",
      mensaje:
        "Falta definir marcas del producto antes de saber si corresponde el rotulado frontal. Falta: {marcas}.",
      incluir_marcas_pendientes: true,
    },
    {
      clave: "sin_marcas",
      cuando: [{ campo: "siempre", operador: "es_verdadero" }],
      estado: "exceptuado",
      mensaje:
        "El producto se comercializa envasado y no tiene azúcares, grasas ni sodio agregados, ni edulcorantes ni cafeína: queda exceptuado del rotulado frontal.",
    },
  ],
};

export interface ReglaRotulado {
  id: number;
  version: number;
  vigente: boolean;
  vigencia_desde: string;
  norma_origen: string;
  requiere_envasado: boolean;
  obliga_azucares: boolean;
  obliga_grasas: boolean;
  obliga_sodio: boolean;
  obliga_edulcorantes: boolean;
  obliga_cafeina: boolean;
  clases_edulcorante: string[];
  validar_ins_edulcorantes: boolean;
  ins_edulcorantes: string[];
  ingredientes_cafeina: string[];
  umbrales_sellos: ParametroNormativo[];
  formulas_nutricionales: ParametroNormativo[];
  reglas_aplicabilidad: ReglasAplicabilidad;
  creado_en: string;
}

export type ReglaRotuladoInput = Omit<ReglaRotulado, "id" | "version" | "vigente" | "creado_en">;

export interface ConfiguracionRotulado {
  configurada: boolean;
  envasado_sin_cliente: boolean | null;
  azucares_agregados: boolean | null;
  grasas_agregadas: boolean | null;
  sodio_agregado: boolean | null;
  edulcorantes: boolean | null;
  cafeina: boolean | null;
  canal_comercializacion: CanalComercializacion;
}

export type ConfiguracionRotuladoInput = Omit<ConfiguracionRotulado, "configurada"> & {
  categoria_rotulado?: string | null;
  categoria_exceptuada_por_ley?: boolean | null;
};

export interface FuenteMarca {
  insumo_id: number;
  nombre: string;
  tipo: string;
  motivo: string;
}

export interface MarcaRotulado {
  clave: ClaveMarca;
  nombre: string;
  obligatoria: boolean;
  valor: boolean | null;
  origen: OrigenMarca | null;
  resuelta: boolean;
  fuentes: FuenteMarca[];
}

export type TipoCalculoSello =
  | "proporcion_energia"
  | "mg_por_kcal"
  | "valor_absoluto";

export interface PasoCalculoSello {
  descripcion: string;
  valor: string | null;
  unidad: string;
}

export interface ResultadoSello {
  clave: string;
  etiqueta: string;
  tipo: TipoCalculoSello;
  criterio: string;
  nutriente: string;
  nombre_nutriente: string;
  unidad_nutriente: string;
  valor_nutriente: string | null;
  valor_calculado: string | null;
  unidad_calculado: string;
  umbral: string | null;
  unidad_umbral: string;
  formula: string | null;
  pasos: PasoCalculoSello[];
  exceso: boolean | null;
  evaluado: boolean;
  motivo: string | null;
}

export interface SellosRotulado {
  evaluado: boolean;
  completo: boolean;
  motivo: string | null;
  excesos: string[];
  resultados: ResultadoSello[];
  regla_version: number;
  vigencia_desde: string;
  norma_origen: string;
}

export interface VersionRotulado {
  id: number;
  numero: number;
  rendimiento: string;
  unidad: string;
}

export interface InstantaneaParametrosRotulado {
  regla_id: number;
  regla_version: number;
  vigente: boolean;
  vigencia_desde: string;
  norma_origen: string;
  requiere_envasado: boolean;
  obliga_azucares: boolean;
  obliga_grasas: boolean;
  obliga_sodio: boolean;
  obliga_edulcorantes: boolean;
  obliga_cafeina: boolean;
  clases_edulcorante: string[];
  validar_ins_edulcorantes: boolean;
  ins_edulcorantes: string[];
  ingredientes_cafeina: string[];
  umbrales_sellos: ParametroNormativo[];
  formulas_nutricionales: ParametroNormativo[];
  reglas_aplicabilidad: ReglasAplicabilidad;
}

export interface InstantaneaRotulado {
  version_esquema: number;
  evaluado_en: string;
  estado: EstadoRotulado;
  mensaje: string;
  modulo_activo: boolean;
  parametros: InstantaneaParametrosRotulado;
  regla_id: number;
  regla_version: number;
  norma_origen: string;
  receta_id: number | null;
  version_receta_id: number | null;
  version_receta_numero: number | null;
  configuracion: ConfiguracionRotulado;
  categoria_rotulado: string | null;
  categoria_exceptuada_por_ley: boolean;
  canal_comercializacion: CanalComercializacion;
  envasado_sin_cliente: boolean | null;
  faltantes: string[];
  advertencias: string[];
  marcas: MarcaRotulado[];
  sellos?: SellosRotulado | null;
}

export interface EvaluacionRotulado {
  producto_id: number;
  producto: string;
  receta_id: number | null;
  version: VersionRotulado | null;
  regla: ReglaRotulado;
  configuracion: ConfiguracionRotulado;
  categoria_rotulado: string | null;
  categoria_exceptuada_por_ley: boolean;
  modulo_activo: boolean;
  estado: EstadoRotulado;
  mensaje: string;
  faltantes: string[];
  advertencias: string[];
  marcas: MarcaRotulado[];
  sellos: SellosRotulado;
  evaluado_en: string;
  instantanea: InstantaneaRotulado;
}
