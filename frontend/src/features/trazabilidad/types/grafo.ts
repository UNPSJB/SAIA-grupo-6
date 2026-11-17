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
  metadatos: Record<string, any>;
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
