import type { HistorialChecklistItem } from "./checklist";

/** Un día del gráfico. `porcentaje` es `null` si ese día no hubo tareas. */
export interface PuntoDiario {
  /** `YYYY-MM-DD`. */
  fecha: string;
  /** `dd/mm`, para el eje. */
  etiqueta: string;
  porcentaje: number | null;
  cumplidas: number;
  total: number;
}

/** Máximo de días que se pueden consultar de una vez. */
export const MAX_DIAS_RANGO = 366;

function aIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** `YYYY-MM-DD` a fecha local, sin pasar por UTC (que la correría un día). */
function desdeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Rango por defecto: del día 1 del mes en curso hasta hoy. */
export function rangoInicial(hoyIso: string): { desde: string; hasta: string } {
  return { desde: `${hoyIso.slice(0, 7)}-01`, hasta: hoyIso };
}

/** `null` si el rango sirve; si no, el mensaje que se le muestra a la persona. */
export function errorDeRango(desde: string, hasta: string, hoyIso: string): string | null {
  if (!desde || !hasta) return "Elegí las dos fechas.";
  if (desde > hasta) return "La fecha «Desde» no puede ser posterior a «Hasta».";
  if (hasta > hoyIso) return "La fecha «Hasta» no puede ser futura.";

  const dias =
    Math.round((desdeIso(hasta).getTime() - desdeIso(desde).getTime()) / 86_400_000) + 1;
  if (dias > MAX_DIAS_RANGO) {
    return `El período no puede superar ${MAX_DIAS_RANGO} días.`;
  }

  return null;
}

/**
 * Porcentaje de cumplimiento de cada día del rango.
 *
 * Se suman las tareas de todos los checklists del día (varios equipos pueden
 * tener checklist el mismo día) y se calcula el porcentaje sobre el total: un
 * promedio de porcentajes pesaría igual a un checklist de 2 tareas que a uno
 * de 20. Un día sin tareas queda en `null`, no en 0%: no tener checklist no es
 * lo mismo que no cumplirlo.
 */
export function cumplimientoPorDia(
  checklists: HistorialChecklistItem[],
  desde: string,
  hasta: string
): PuntoDiario[] {
  const porFecha = new Map<string, { cumplidas: number; total: number }>();

  for (const checklist of checklists) {
    const acumulado = porFecha.get(checklist.fecha) ?? { cumplidas: 0, total: 0 };
    acumulado.cumplidas += checklist.tareas_completadas;
    acumulado.total += checklist.total_tareas;
    porFecha.set(checklist.fecha, acumulado);
  }

  const puntos: PuntoDiario[] = [];
  const cursor = desdeIso(desde);
  const fin = desdeIso(hasta);

  while (cursor <= fin) {
    const fecha = aIso(cursor);
    const dato = porFecha.get(fecha);

    puntos.push({
      fecha,
      etiqueta: `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`,
      cumplidas: dato?.cumplidas ?? 0,
      total: dato?.total ?? 0,
      porcentaje:
        dato && dato.total > 0 ? Math.round((dato.cumplidas / dato.total) * 100) : null,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return puntos;
}