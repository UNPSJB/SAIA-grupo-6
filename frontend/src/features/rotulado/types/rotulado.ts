export interface CampoCompletitud {
  nombre: string;
  etiqueta: string;
  estado: "completo" | "pendiente" | "no_aplicable" | "sin_datos_origen";
  motivo?: string;
}

export interface CompletitudRotulado {
  borrador_id: number;
  estado_global: string;
  campos: CampoCompletitud[];
}

export interface CampoEditadoOut {
  id: number;
  campo: string;
  valor_original: string | null;
  valor_nuevo: string | null;
  origen: string;
  tipo_operacion: string;
  usuario_id: number | null;
  usuario_nombre: string | null;
  modificado_en: string | null;
}

export interface BorradorRotuladoBase {
  denominacion_venta: string | null;
  lista_ingredientes: string | null;
  contenido_neto: string | null;
  rnpa_rppa: string | null;
  razon_social: string | null;
  domicilio: string | null;
  identificacion_lote: string | null;
  fecha_produccion: string | null;
  fecha_cierre: string | null;
  fecha_duracion: string | null;
  instrucciones_uso: string | null;
  es_importado: boolean;
  importador_razon_social: string | null;
  importador_domicilio: string | null;
  estado: string;
  datos_nutricionales_json: string | null;
  sellos_disponibles: boolean;
}

export interface BorradorRotuladoOut extends BorradorRotuladoBase {
  id: number;
  producto_id: number;
  version_receta_id: number | null;
  lote_producto_id: number | null;
  version_receta_numero: number | null;
  lote_numero: string | null;
  producto_nombre: string | null;
  creado_en: string | null;
  actualizado_en: string | null;
  creado_por_id: number | null;
  actualizado_por_id: number | null;
}

export interface ProductoConBorrador {
  producto_id: number;
  producto_nombre: string;
  unidad_simbolo: string | null;
  borrador_id: number | null;
  borrador_estado: string | null;
  borrador_actualizado_en: string | null;
}

export interface AutocompletarIn {
  version_id: number | null;
  lote_id: number | null;
  forzar: boolean;
}

export interface VistaPreviaAutocompletado {
  producto_id: number;
  producto_nombre: string;
  denominacion_venta: string | null;
  lista_ingredientes: string | null;
  datos_nutricionales_json: string | null;
  sellos_disponibles: boolean;
  version_receta_id: number | null;
  version_receta_numero: number | null;
  receta_encontrada: boolean;
  mensaje: string | null;
}

export interface BorradorRotuladoCreate {
  producto_id: number;
  version_receta_id: number | null;
  lote_producto_id: number | null;
  denominacion_venta: string | null;
  lista_ingredientes: string | null;
  contenido_neto: string | null;
  rnpa_rppa: string | null;
  razon_social: string | null;
  domicilio: string | null;
  identificacion_lote: string | null;
  fecha_produccion: string | null;
  fecha_cierre: string | null;
  fecha_duracion: string | null;
  instrucciones_uso: string | null;
  es_importado: boolean;
  importador_razon_social: string | null;
  importador_domicilio: string | null;
  estado: string;
  datos_nutricionales_json: string | null;
  sellos_disponibles: boolean;
}

export interface BorradorRotuladoUpdate {
  denominacion_venta?: string | null;
  lista_ingredientes?: string | null;
  contenido_neto?: string | null;
  rnpa_rppa?: string | null;
  razon_social?: string | null;
  domicilio?: string | null;
  identificacion_lote?: string | null;
  fecha_produccion?: string | null;
  fecha_cierre?: string | null;
  fecha_duracion?: string | null;
  instrucciones_uso?: string | null;
  es_importado?: boolean;
  importador_razon_social?: string | null;
  importador_domicilio?: string | null;
  estado?: string;
  datos_nutricionales_json?: string | null;
  sellos_disponibles?: boolean;
}
