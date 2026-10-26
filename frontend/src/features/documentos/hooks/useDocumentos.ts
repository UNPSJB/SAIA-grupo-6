import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarDocumentos } from "../services/documentoService";
import type { Documento } from "../types/documento";

/**
 * Página actual de documentos, pedida al backend (paginación server-side).
 */
export function useDocumentos(pageSize = 10) {
  const cargar = useCallback(
    (page: number, pageSize: number) => listarDocumentos(page, pageSize),
    []
  );

  const {
    items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    recargar,
  } = useListaPaginada<Documento>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los documentos",
    pageSize,
  });

  return {
    documentos: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    recargar,
  };
}
