export type ColumnaGrafo =
  | 'proveedor'
  | 'insumo'
  | 'lote_producto'
  | 'despacho'
  | 'cliente';

export interface NodoGrafo {
  id: string;
  columna: ColumnaGrafo;
  tipo: string;
  titulo: string;
  subtitulo?: string;
  badge?: string;
  tono_badge?: 'ok' | 'alerta' | 'peligro' | 'info' | 'neutro';
  metadatos: MetadatosNodo;
}

export interface ConexionGrafo {
  id: string;
  origen_id: string;
  destino_id: string;
  etiqueta?: string;
  cliente_id?: number;
}

export interface GrafoTrazabilidadResponse {
  lote_id: number;
  numero_lote: string;
  producto_nombre: string;
  estado_lote: string;
  nodos: NodoGrafo[];
  conexiones: ConexionGrafo[];
}

/**
 * Datos extra de cada nodo, según su columna (los arma `trazabilidad/services.py`).
 * Los números y fechas llegan como texto; los ids, como números.
 */
export interface MetadatosNodo {
  // proveedor
  id?: number;
  nombre?: string;
  matricula?: string | null;
  cuit?: string | null;
  es_certificado?: boolean;
  activo?: boolean;
  // lote de insumo
  lote_insumo_id?: number;
  numero_lote?: string;
  marca?: string | null;
  fecha_ingreso?: string | null;
  vence?: string | null;
  cantidad_usada?: string;
  // lote de producto
  producido?: string;
  inicio?: string | null;
  vencimiento?: string | null;
  version_receta?: number | null;
  operario?: string | null;
  // despacho
  salida_id?: number;
  cantidad?: string;
  fecha_despacho?: string | null;
  transportista?: string | null;
  certificaciones_transportista?: unknown;
  // cliente
  cliente_id?: number;
  direccion?: string;
  fecha_entrega?: string | null;
  recibido_por?: string | null;
  estado_salida?: string;
}
