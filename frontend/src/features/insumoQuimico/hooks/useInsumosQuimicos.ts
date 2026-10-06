import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarInsumosQuimicos } from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

export function useInsumosQuimicos(incluirInactivos = false) {
  const cargarInsumos = useCallback(() => listarInsumosQuimicos(incluirInactivos), [incluirInactivos]);

  const { items, loading, error, recargar } = useLista<InsumoQuimico[]>({
    cargar: cargarInsumos,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los insumos químicos",
  });

  return { insumos: items, loading, error, cargarInsumos: recargar };
}