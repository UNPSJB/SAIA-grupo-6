import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarElementosLimpieza } from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

export function useElementosLimpieza(incluirInactivos = false) {
  const cargarElementosLimpieza = useCallback(
    () => listarElementosLimpieza(incluirInactivos),
    [incluirInactivos],
  );

  const { items, loading, error, recargar } = useLista<ElementoLimpieza[]>({
    cargar: cargarElementosLimpieza,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los elementos de limpieza",
  });

  return {
    elementosLimpieza: items,
    loading,
    error,
    cargarElementosLimpieza: recargar,
  };
}