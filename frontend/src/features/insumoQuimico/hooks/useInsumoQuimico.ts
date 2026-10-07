import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerInsumoQuimico } from "../services/insumoQuimicoService";
import type { InsumoQuimico } from "../types/insumoQuimico";

export function useInsumoQuimico(id: number | null) {
  const { registro, loading, error } = useRegistro<InsumoQuimico>({
    cargar: obtenerInsumoQuimico,
    id,
    etiqueta: "el insumo químico",
  });

  return { insumoQuimico: registro, loading, error };
}