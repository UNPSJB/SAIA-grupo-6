import { useEffect, useState } from "react";
import {
  listarDocumentosVigentes,
  type FiltrosDocumentosVigentes,
} from "../services/documentoService";
import type { DocumentoVigente } from "../types/documento";

/**
 * Una página de documentos vigentes, con los filtros aplicados en el
 * servidor. Conserva el debounce de 300 ms de siempre: la búsqueda es
 * mientras se escribe y sin él disparaba un pedido por tecla.
 *
 * La página (y el reinicio a la página 1 al cambiar un filtro) la maneja el
 * componente que llama a este hook, porque el debounce tiene que esperar
 * también al cambio de página.
 */
export function useDocumentosVigentes(
  filtros: FiltrosDocumentosVigentes = {},
  page: number,
  pageSize = 10
) {
  const { buscar = "", tipo = "", estado = "", orden = "nombre_asc" } = filtros;
  const [documentos, setDocumentos] = useState<DocumentoVigente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await listarDocumentosVigentes(page, pageSize, {
          buscar,
          tipo,
          estado,
          orden,
        });
        if (!cancelado) {
          setDocumentos(data.items);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelado) {
          setError("No se pudieron cargar los documentos");
          console.error(err);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [buscar, tipo, estado, orden, page, pageSize]);

  return { documentos, total, loading, error };
}
