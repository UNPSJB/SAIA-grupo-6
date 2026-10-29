import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import { listarDocumentos, type FiltrosDocumentos } from "../services/documentoService";
import type { Documento } from "../types/documento";

/**
 * Página actual de documentos.
 */
export function useDocumentos(filtros: FiltrosDocumentos = {}, pageSize = 10) {
  const { buscar, tipo = "", estado = "", orden = "nombre_asc" } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarDocumentos(page, pageSize, { buscar, tipo, estado, orden }),
    [buscar, tipo, estado, orden]
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
    dependencias: [buscar, tipo, estado, orden],
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
