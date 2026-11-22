import { Alert, Button, List, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { ResumenEntidadDialog } from "../../../components/ui/ResumenEntidadDialog";
import { evaluarRotulado } from "../../rotuladoFrontal/services/rotuladoFrontalService";
import type { EvaluacionRotulado } from "../../rotuladoFrontal/types/rotuladoFrontal";
import type { Producto } from "../types/producto";

export function ResumenProductoDialog({
  producto, onCerrar, onNutricion, onRotulado,
}: {
  producto: Producto;
  onCerrar: () => void;
  onNutricion: () => void;
  onRotulado: () => void;
}) {
  const [evaluacion, setEvaluacion] = useState<EvaluacionRotulado | "error" | null>(null);

  useEffect(() => {
    if (!producto.activo) return;
    let vigente = true;
    evaluarRotulado(producto.id, undefined, true).then(
      resultado => { if (vigente) setEvaluacion(resultado); },
      () => { if (vigente) setEvaluacion("error"); },
    );
    return () => { vigente = false; };
  }, [producto.activo, producto.id]);

  const faltantes = evaluacion && evaluacion !== "error" ? evaluacion.faltantes : [];

  return (
    <ResumenEntidadDialog
      nombre={producto.nombre}
      activo={producto.activo}
      campos={[
        { etiqueta: "Descripción", valor: producto.descripcion?.trim() || "Sin descripción" },
        { etiqueta: "Unidad de medida", valor: `${producto.unidad_medida.nombre} (${producto.unidad_medida.simbolo})` },
      ]}
      onCerrar={onCerrar}
      acciones={producto.activo && <>
        <Button variant="ghost" onClick={onNutricion}>Información nutricional</Button>
        <Button variant="ghost" onClick={onRotulado}>Rotulado frontal</Button>
      </>}
    >
      {producto.activo && evaluacion === null && (
        <Text role="status" fontSize="sm" color="fg.muted">Consultando rotulado frontal…</Text>
      )}
      {evaluacion === "error" && (
        <Text role="status" fontSize="sm" color="fg.muted">No se pudo consultar el estado del rotulado frontal.</Text>
      )}
      {faltantes.length > 0 && (
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Faltan datos para evaluar el rotulado frontal</Alert.Title>
            <List.Root ps="5">
              {faltantes.map(faltante => <List.Item key={faltante}>{faltante}</List.Item>)}
            </List.Root>
          </Alert.Content>
        </Alert.Root>
      )}
    </ResumenEntidadDialog>
  );
}
