import { EtiquetaEstado, type TonoEstado } from "../../../components/ui/patrones";
import { ESTADOS_LOTE } from "../types/lote";

const TONOS: Record<string, TonoEstado> = {
  en_proceso: "info",
  terminado: "ok",
  cancelado: "peligro",
};

export function BadgeEstadoLote({ estado }: { estado: string }) {
  const etiqueta =
    ESTADOS_LOTE.find((e) => e.valor === estado)?.etiqueta ?? estado.replaceAll("_", " ");

  return <EtiquetaEstado tono={TONOS[estado] ?? "neutro"}>{etiqueta}</EtiquetaEstado>;
}
