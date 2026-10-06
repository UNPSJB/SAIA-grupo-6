import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerElementoLimpieza } from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

export function useElementoLimpieza(id: number | null) {
  const { registro, loading, error } = useRegistro<ElementoLimpieza>({
    cargar: obtenerElementoLimpieza,
    id,
    etiqueta: "el elemento de limpieza",
  });

  return {
    elementoLimpieza: registro,
    loading,
    error,
  };
}