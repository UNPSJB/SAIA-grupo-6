import { TIPOS_DOCUMENTO } from "../types/documento";

export const etiquetaTipo = (tipo: string) =>
  TIPOS_DOCUMENTO.find((t) => t.value === tipo)?.label ?? tipo;

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR") : "—";

export const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";