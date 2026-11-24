import type { ProduccionDelDia } from "../types/paneles";

/** Unidades con producción, de la de mayor volumen a la menor. */
export function unidadesDe(porDia: ProduccionDelDia[]): string[] {
  const totales = new Map<string, number>();
  for (const p of porDia) totales.set(p.unidad, (totales.get(p.unidad) ?? 0) + p.cantidad);
  return [...totales.entries()].sort((a, b) => b[1] - a[1]).map(([unidad]) => unidad);
}
