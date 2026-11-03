export type AccionAuditoria = 'CREAR' | 'MODIFICAR' | 'BAJA' | 'REACTIVAR' | 'ELIMINAR';

export interface CambioCampoEnriquecido {
  antes: unknown;
  despues: unknown;
  antes_nombre?: string | null;
  despues_nombre?: string | null;
}

/** Un dato que describe al registro afectado (DNI, código, una relación...). */
export interface DatoRegistro {
  campo: string;
  valor: unknown;
  /** Si el campo es una FK: nombre legible del objeto relacionado. */
  valor_nombre?: string | null;
}

/** Qué registro se tocó: etiqueta legible + datos identificatorios. */
export interface RegistroAuditado {
  etiqueta?: string | null;
  datos: DatoRegistro[];
}

export interface AuditLogItem {
  id: number;
  fecha: string;
  usuario_id: number | null;
  usuario_nombre: string | null;
  entidad: string;
  entidad_id: string;
  accion: AccionAuditoria;
  cambios: Record<string, [unknown, unknown]> | null;
  // Versión enriquecida: {"campo": {"antes": ..., "despues": ..., "antes_nombre": ..., "despues_nombre": ...}}
  // con nombres legibles de entidades relacionadas en vez de solo IDs.
  cambios_detalle?: Record<string, CambioCampoEnriquecido> | null;
  // El registro afectado (nombre, DNI, relaciones), también en bajas,
  // reactivaciones y modificaciones, donde el diff no lo incluye.
  registro?: RegistroAuditado | null;
}

export interface AuditLogPagina {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditLogFiltros {
  entidad?: string;
  entidad_id?: string;
  usuario_id?: number | null;
  accion?: AccionAuditoria;
  desde?: string;
  hasta?: string;
  page?: number;
  page_size?: number;
}
