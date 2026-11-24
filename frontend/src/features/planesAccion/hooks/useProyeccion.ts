import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { proyectarAlcance } from "../services/planAccionService";
import type { ProyeccionElemento } from "../types/planAccion";

/**
 * Cómo quedaría el riesgo de los elementos si se trataran estas situaciones.
 * Se vuelve a pedir cuando cambia la selección. Si falla, no rompe el
 * formulario: la proyección es una ayuda, no un requisito.
 */
export function useProyeccion(situacionIds: number[]) {
  // La identidad de `cargar` sigue al contenido de la selección, no al array.
  const clave = [...situacionIds].sort((a, b) => a - b).join(",");
  const cargar = useCallback(
    () => (clave === "" ? Promise.resolve([]) : proyectarAlcance(clave.split(",").map(Number))),
    [clave],
  );
  const { items, loading, error } = useLista<ProyeccionElemento[]>({
    cargar,
    dependencias: [clave],
    valorInicial: [],
    mensajeError: "No se pudo calcular la proyección del riesgo",
    vaciarAlFallar: true,
  });
  return { proyeccion: items, loading, error };
}
