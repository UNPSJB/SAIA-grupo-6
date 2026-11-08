import { formatoFecha } from "../../../common/utils/fechas";
import { TIPOS_DOCUMENTO } from "../types/documento";

export const etiquetaTipo = (tipo: string) =>
  TIPOS_DOCUMENTO.find((t) => t.value === tipo)?.label ?? tipo;

/*
 * Delega en `common/utils/fechas`: el `new Date("YYYY-MM-DD")` que había acá
 * se interpreta como UTC y en Argentina mostraba el día anterior.
 */
export const fechaCorta = (iso: string | null) => formatoFecha(iso);

export const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";