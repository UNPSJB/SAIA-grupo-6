import { Badge } from "@chakra-ui/react";

/** Pill compacta "Origen: …": siempre del ancho de su texto, nunca estirada. */
export function CampoOrigen({ origen, version }: { origen: string | null; version?: number | null }) {
  const opciones: Record<string, [string, string]> = {
    producto: ["Producto", "blue"], receta: ["Receta", "green"],
    nutricion: ["Info. nutricional", "purple"], lote: ["Lote", "orange"], manual: ["Manual", "gray"],
    establecimiento: ["Establecimiento", "teal"],
  };
  const [etiqueta, color] = opciones[origen ?? "manual"] ?? opciones.manual;
  return <Badge colorPalette={color} variant="subtle" rounded="full" size="sm" px="2" display="inline-flex"
    w="fit-content" alignSelf="flex-start" flexShrink={0} whiteSpace="nowrap">
    Origen: {etiqueta}{origen === "receta" && version != null ? ` v${version}` : ""}
  </Badge>;
}
