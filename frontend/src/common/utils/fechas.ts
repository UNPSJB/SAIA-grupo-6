/**
 * Formateo de fechas en el timezone de la app.
 *
 * Antes cada componente definiía su propio `formatearFecha`, y una de las
 * copias estaba mal: `elementoLimpiezaItem.tsx` hacía
 * `new Date(elemento.fecha_ultimo_recambio)` sobre un string `"YYYY-MM-DD"`.
 * Eso se parsea como UTC, así que al oeste de Greenwich la fecha se mostraba
 * corrida un día. Las otras copias ya anexaban `T00:00:00` para forzar la
 * lectura como local; acá se hace una sola vez y con el timezone explícito.
 */

const FECHA_AR = {
  timeZone: "America/Argentina/Buenos_Aires",
  hour12: false,
} as const;

const SOLO_DIA_AR = {
  timeZone: "America/Argentina/Buenos_Aires",
} as const;

/**
 * Fecha y hora legible. Acepta lo que devuelve el backend (ISO con o sin `Z`).
 */
export function formatoFechaHora(iso: string | null | undefined): string {
  if (!iso) return "-";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? "-" : fecha.toLocaleString("es-AR", FECHA_AR);
}

/**
 * Solo el día, para fechas que son calendariales (una fecha de vencimiento, un
 * último recambio). No cambia de día según dónde esté el navegador.
 */
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return "-";
  // `YYYY-MM-DD` se interpreta como UTC midnight en el constructor ISO, que
  // es exactamente el origen del desfase de un día. Se fuerza hora local
  // antes de formatear.
  const normalizada = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  const fecha = new Date(normalizada);
  return Number.isNaN(fecha.getTime())
    ? "-"
    : fecha.toLocaleDateString("es-AR", SOLO_DIA_AR);
}

/** Igual que `formatoFecha` pero devuelve un guion largo cuando no hay valor. */
export function formatoFechaOCorta(iso: string | null | undefined): string {
  return iso ? formatoFecha(iso) : "-";
}

/** Fecha de hoy en formato `YYYY-MM-DD`, para los `<input type="date">`. */
export function hoyISO(): string {
  return fechaLocalISO(new Date());
}

/** Fecha de hace `dias` días en formato `YYYY-MM-DD`. */
export function haceDiasISO(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocalISO(fecha);
}

/**
 * `YYYY-MM-DD` en hora local. `toISOString()` no sirve: convierte a UTC y en
 * el timezone UTC-3 devuelve el día anterior.
 */
export function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}