import { API_URL } from "../../../common/api/apiClient";
import { apiFetch } from "../../../common/api/apiClient";
import { pedir } from "../../../common/api/errors";
import type { AuditLogFiltros, AuditLogPagina } from "../types/auditoria";

function paramsFiltros(filtros: AuditLogFiltros): URLSearchParams {
  const params = new URLSearchParams();

  if (filtros.entidad) params.set('entidad', filtros.entidad);
  if (filtros.entidad_id) params.set('entidad_id', filtros.entidad_id);
  if (filtros.usuario_id !== undefined && filtros.usuario_id !== null) {
    params.set('usuario_id', String(filtros.usuario_id));
  }
  if (filtros.accion) params.set('accion', filtros.accion);
  if (filtros.desde) params.set('desde', filtros.desde);
  if (filtros.hasta) params.set('hasta', filtros.hasta);
  return params;
}

export async function listarAuditoria(filtros: AuditLogFiltros): Promise<AuditLogPagina> {
  const params = paramsFiltros(filtros);
  if (filtros.page) params.set('page', String(filtros.page));
  if (filtros.page_size) params.set('page_size', String(filtros.page_size));

  const url = `${API_URL}/auditoria${params.toString() ? '?' + params.toString() : ''}`;
  const response = await apiFetch(url);
  return pedir<AuditLogPagina>(response, 'Error al obtener la auditoría');
}

export type FormatoExportacion = 'csv' | 'pdf';

/** Descarga la bitácora completa (sin paginar) con los filtros dados. */
export async function exportarAuditoria(filtros: AuditLogFiltros, formato: FormatoExportacion): Promise<void> {
  const params = paramsFiltros(filtros);
  params.set('formato', formato);

  const response = await apiFetch(`${API_URL}/auditoria/exportar?${params.toString()}`);
  if (!response.ok) throw new Error('Error al exportar la auditoría');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria.${formato}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function listarEntidades(): Promise<string[]> {
  const response = await apiFetch(`${API_URL}/auditoria/entidades`);
  return pedir<string[]>(response, 'Error al obtener entidades');
}
