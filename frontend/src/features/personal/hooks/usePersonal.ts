import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerPersona } from "../services/personalService";
import type { Persona } from "../types/personal";

export function usePersonal(id: number | null) {
  const { registro, loading, error } = useRegistro<Persona>({
    cargar: obtenerPersona,
    id,
    etiqueta: "el personal",
  });

  return { persona: registro, loading, error };
}