/** Rango por defecto: del día 1 del mes en curso hasta hoy. */
export function rangoInicial(hoyIso: string): { desde: string; hasta: string } {
  return { desde: `${hoyIso.slice(0, 7)}-01`, hasta: hoyIso };
}
