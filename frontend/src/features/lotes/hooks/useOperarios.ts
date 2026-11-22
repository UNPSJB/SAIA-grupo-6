import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarPersonal } from "../../personal/services/personalService";
import type { Persona } from "../../personal/types/personal";

/**
 * Personas que operan, para asignarles tareas de producción. Solo quien
 * administra las pide (el listado de personal es suyo): con `habilitado` en
 * false devuelve una lista vacía sin llamar al backend.
 */
export function useOperarios(habilitado: boolean) {
  const cargar = useCallback(async (): Promise<Persona[]> => {
    if (!habilitado) return [];
    const pagina = await listarPersonal(1, 100, { rol: "operador", orden: "nombre_asc" });
    return pagina.items;
  }, [habilitado]);

  const lista = useLista<Persona[]>({
    cargar,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudo cargar el personal que opera.",
  });
  return { operarios: lista.items, loading: lista.loading, error: lista.error };
}

export const nombrePersona = (p: Pick<Persona, "nombre" | "apellido">) =>
  [p.nombre, p.apellido].filter(Boolean).join(" ");
