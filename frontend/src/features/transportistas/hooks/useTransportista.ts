import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerTransportista } from "../services/transportistaService";
import type { Transportista } from "../types/transportista";

export function useTransportista(id: number | null) {
  const { registro, loading, error, recargar } = useRegistro<Transportista>({
    cargar: obtenerTransportista,
    id,
    etiqueta: "el transportista",
  });

  return {
    transportista: registro,
    loading,
    error,
    cargarTransportista: recargar,
  };
}
