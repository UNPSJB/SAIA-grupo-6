import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarAptitudes } from "../services/aptitudService";
import type { Aptitud } from "../types/aptitud";

export function useAptitudes(incluirInactivos = false) {
  const cargarAptitudes = useCallback(() => listarAptitudes(incluirInactivos), [incluirInactivos]);

  const { items, loading, error, recargar } = useLista<Aptitud[]>({
    cargar: cargarAptitudes,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las aptitudes",
  });

  return { aptitudes: items, loading, error, cargarAptitudes: recargar };
}