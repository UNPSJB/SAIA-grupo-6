import { Badge } from "@chakra-ui/react";

export function CampoOrigen({ origen, version }: { origen: string | null; version?: number | null }) {
  const opciones: Record<string, [string, string]> = {
    producto: ["Producto", "blue"], receta: ["Receta", "green"],
    nutricion: ["Info. nutricional", "purple"], lote: ["Lote", "orange"], manual: ["Manual", "gray"],
  };
  const [etiqueta, color] = opciones[origen ?? "manual"] ?? opciones.manual;
  return <Badge colorPalette={color} variant="subtle" rounded="full" px="3" py="1" mt="2" whiteSpace="normal">
    Origen: {etiqueta}{origen === "receta" && version != null ? ` v${version}` : ""}
  </Badge>;
}
