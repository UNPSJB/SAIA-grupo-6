export type AccionAuditoria = 'CREAR' | 'MODIFICAR' | 'BAJA' | 'REACTIVAR' | 'ELIMINAR';

export interface AuditLogItem {
  id: number;
  fecha: string;
  usuario_id: number | null;
  usuario_nombre: string | null;
  entidad: string;
  entidad_id: string;
  accion: AccionAuditoria;
  cambios: Record<string, [any, any]> | null;
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
