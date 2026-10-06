import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerEquipo } from "../services/equipoService";
import type { Equipo } from "../types/equipo";

export function useEquipo(id: number | null) {
  const { registro, loading, error } = useRegistro<Equipo>({
    cargar: obtenerEquipo,
    id,
    etiqueta: "el equipo",
  });

  return {
    equipo: registro,
    loading,
    error,
  };
}