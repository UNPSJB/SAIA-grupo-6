import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerUnidadMedida } from "../services/unidadMedidaService";
import type { UnidadMedida } from "../types/unidadMedida";

export function useUnidadMedida(id: number | null) {
  const { registro, loading, error } = useRegistro<UnidadMedida>({
    cargar: obtenerUnidadMedida,
    id,
    etiqueta: "la unidad de medida",
  });

  return { unidadMedida: registro, loading, error };
}