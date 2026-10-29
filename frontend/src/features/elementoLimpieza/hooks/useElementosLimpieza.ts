import { useCallback } from "react";
import { useListaPaginada } from "../../../common/hooks/useListaPaginada";
import {
  listarElementosLimpieza,
  type FiltrosElementosLimpieza,
} from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

/**
 * Página actual de elementos de limpieza, pedida al backend (server-side).
 * El selector del checklist usa `listarOpcionesElementosLimpieza`, que sigue
 * devolviendo la lista liviana completa.
 */
export function useElementosLimpieza(
  filtros: FiltrosElementosLimpieza = {},
  pageSize = 10
) {
  const {
    incluirInactivos = false,
    buscar,
    orden = "nombre_asc",
  } = filtros;

  const cargar = useCallback(
    (page: number, pageSize: number) =>
      listarElementosLimpieza(page, pageSize, {
        incluirInactivos,
        buscar,
        orden,
      }),
    [incluirInactivos, buscar, orden]
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
  } = useListaPaginada<ElementoLimpieza>({
    cargar,
    dependencias: [incluirInactivos, buscar, orden],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los elementos de limpieza",
    pageSize,
  });

  return {
    elementosLimpieza: items,
    total,
    page,
    setPage,
    hayVariasPaginas,
    loading,
    error,
    cargarElementosLimpieza: recargar,
  };
}
