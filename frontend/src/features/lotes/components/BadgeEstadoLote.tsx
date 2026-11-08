import { Badge } from "@chakra-ui/react";
import { ESTADOS_LOTE } from "../types/lote";

const COLORES: Record<string, "blue" | "green" | "red" | "gray"> = {
  en_proceso: "blue",
  terminado: "green",
  cancelado: "red",
};

export function BadgeEstadoLote({ estado }: { estado: string }) {
  const etiqueta =
    ESTADOS_LOTE.find((e) => e.valor === estado)?.etiqueta ?? estado.replaceAll("_", " ");

  return (
    <Badge colorPalette={COLORES[estado] ?? "gray"} variant="subtle">
      {etiqueta}
    </Badge>
  );
}
