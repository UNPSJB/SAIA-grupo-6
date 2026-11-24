import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarLotes } from "../services/loteService";
import type { FiltrosLotes, LoteResumen } from "../types/lote";

export function useLotes(filtros: FiltrosLotes = {}) {
  const { estado, fechaDesde, fechaHasta } = filtros;

  const cargar = useCallback(
    () => listarLotes({ estado, fechaDesde, fechaHasta }),
    [estado, fechaDesde, fechaHasta],
  );

  const { items, loading, error, recargar } = useLista<LoteResumen[]>({
    cargar,
    dependencias: [estado, fechaDesde, fechaHasta],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los lotes de producción",
  });

  return { lotes: items, loading, error, recargar };
}
