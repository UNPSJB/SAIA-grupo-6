import type { TonoEstado } from "../../../components/ui/patrones";
import { diasDesdeHoy } from "./dashboard";

/** Cuántos días se mira hacia atrás / adelante en los paneles de categoría. */
export const DIAS_PERIODO = 30;

/** Filas que muestra cada lista de un panel: el resto se ve en su pantalla. */
export const FILAS_LISTA = 6;

/**
 * Los listados paginados se piden de a una página del máximo que acepta el
 * backend (`PAGE_SIZE_MAXIMO`). Los totales salen de `total`, que cuenta todo;
 * las listas del panel miran solo esta primera página.
 */
export const PAGINA_COMPLETA = 100;

/** Días hasta una fecha `YYYY-MM-DD` o ISO completa (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  return diasDesdeHoy(fecha.slice(0, 10));
}

const plural = (n: number, uno: string, muchos: string) => (n === 1 ? uno : muchos);

/** Estado de un plazo en palabras: "Venció hace 3 días", "Vence en 5 días". */
export function estadoPlazo(dias: number): { tono: TonoEstado; texto: string } {
  if (dias < 0) {
    const n = -dias;
    return { tono: "peligro", texto: `Venció hace ${n} ${plural(n, "día", "días")}` };
  }
  if (dias === 0) return { tono: "peligro", texto: "Vence hoy" };
  return {
    tono: dias <= 7 ? "alerta" : "info",
    texto: `Vence en ${dias} ${plural(dias, "día", "días")}`,
  };
}

/** Cuenta los elementos por clave y devuelve `{ etiqueta, valor }` para las barras. */
export function contarPor<T>(
  items: T[],
  clave: (item: T) => string,
): { etiqueta: string; valor: number }[] {
  const conteo = new Map<string, number>();
  for (const item of items) {
    const k = clave(item);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return [...conteo].map(([etiqueta, valor]) => ({ etiqueta, valor }));
}
