import { createContext, useContext } from "react";
import type { RangoGrafico } from "../../exportacion";

/**
 * Período que muestra el panel, para que cada gráfico lo ponga en el nombre y en el encabezado
 * del archivo que se descarga. Lo da `MarcoPanel`; así los bloques no lo reciben uno por uno.
 */
export const ContextoRangoDescarga = createContext<RangoGrafico | null>(null);

export function useRangoDescarga(): RangoGrafico | null {
  return useContext(ContextoRangoDescarga);
}

/** El período (`desde` y `hasta`) que traen los datos de cada panel, o `null` si no lo traen. */
export function rangoDePanel(datos: unknown): RangoGrafico | null {
  if (typeof datos !== "object" || datos === null) return null;
  const periodo = (datos as { periodo?: unknown }).periodo;
  if (typeof periodo !== "object" || periodo === null) return null;
  const { desde, hasta } = periodo as { desde?: unknown; hasta?: unknown };
  if (typeof desde !== "string" || typeof hasta !== "string" || !desde || !hasta) return null;
  return { desde, hasta };
}
