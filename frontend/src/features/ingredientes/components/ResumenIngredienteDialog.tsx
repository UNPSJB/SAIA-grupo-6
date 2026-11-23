import { Button } from "@chakra-ui/react";
import { formatoCantidad } from "../../../common/utils/numeros";
import { ResumenEntidadDialog } from "../../../components/ui/ResumenEntidadDialog";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import type { Ingrediente } from "../types/ingrediente";

/**
 * Resumen de solo lectura de un ingrediente. Los alérgenos no van acá: se
 * declaran por insumo (marca), no por ingrediente.
 */
export function ResumenIngredienteDialog({
  ingrediente, onCerrar, onNutricion,
}: {
  ingrediente: Ingrediente;
  onCerrar: () => void;
  onNutricion: () => void;
}) {
  return (
    <ResumenEntidadDialog
      nombre={ingrediente.nombre}
      activo={ingrediente.activo}
      campos={[
        { etiqueta: "Aditivo", valor: ingrediente.aditivo
          ? etiquetaAditivo(ingrediente.aditivo) : ingrediente.es_aditivo ? "Sí" : "No" },
        { etiqueta: "Unidad de medida", valor: ingrediente.unidad_medida
          ? `${ingrediente.unidad_medida.nombre} (${ingrediente.unidad_medida.simbolo})` : "Sin unidad registrada" },
        { etiqueta: "Densidad", valor: ingrediente.densidad_g_ml == null
          ? "Sin registrar" : `${formatoCantidad(ingrediente.densidad_g_ml)} g/ml` },
        { etiqueta: "Peso unitario", valor: ingrediente.peso_unitario_g == null
          ? "Sin registrar" : `${formatoCantidad(ingrediente.peso_unitario_g)} g` },
        { etiqueta: "Proveedores", valor: ingrediente.proveedores?.map(proveedor => proveedor.nombre).join(", ") || "Sin asociar" },
      ]}
      onCerrar={onCerrar}
      acciones={ingrediente.activo && <Button variant="ghost" onClick={onNutricion}>Datos nutricionales</Button>}
    />
  );
}
