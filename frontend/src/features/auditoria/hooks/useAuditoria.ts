import { useCallback, useState } from 'react';
import { listarAuditoria } from '../services/auditoriaService';
import type { AuditLogFiltros, AuditLogItem, AuditLogPagina } from '../types/auditoria';

export function useAuditoria() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (filtros: AuditLogFiltros) => {
    setLoading(true);
    setError(null);
    try {
      const pagina: AuditLogPagina = await listarAuditoria(filtros);
      setItems(pagina.items);
      setTotal(pagina.total);
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar auditoría');
    } finally {
      setLoading(false);
    }
  }, []);

  return { items, total, loading, error, cargar };
}
