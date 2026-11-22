import { Badge, HStack, Stack, Table, Text } from "@chakra-ui/react";
import type { Ingrediente } from "../types/ingrediente";
import { formatoCantidad } from "../../../common/utils/numeros";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  PildoraNeutra,
  TextoTruncado,
} from "../../../components/ui/patrones";

interface IngredienteItemProps {
  ingrediente: Ingrediente;
  onEdit: (ingrediente: Ingrediente) => void;
  onDelete: (ingrediente: Ingrediente) => void;
  onReactivar: (ingrediente: Ingrediente) => void;
  onNutricion: (ingrediente: Ingrediente) => void;
}

export function IngredienteItem({
  ingrediente,
  onEdit,
  onDelete,
  onReactivar,
  onNutricion,
}: IngredienteItemProps) {
  const unidadLabel = ingrediente.unidad_medida
    ? `${ingrediente.unidad_medida.nombre} (${ingrediente.unidad_medida.simbolo})`
    : `#${ingrediente.unidad_medida_id}`;

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={ingrediente.activo ? 1 : 0.65}>
      <Celda>
        <DatoPrincipal titulo={ingrediente.nombre} />
      </Celda>
      <Celda>
        <Stack gap="1" align="flex-start">
          <Badge colorPalette={ingrediente.es_aditivo ? "purple" : "gray"} variant="subtle">
            {ingrediente.es_aditivo ? "Sí" : "No"}
          </Badge>
          {ingrediente.aditivo && (
            <Text fontSize="xs" color="fg.muted">
              {etiquetaAditivo(ingrediente.aditivo)}
            </Text>
          )}
        </Stack>
      </Celda>
      <Celda center>
        <span title={unidadLabel}>
          <PildoraNeutra>{ingrediente.unidad_medida?.simbolo ?? unidadLabel}</PildoraNeutra>
        </span>
      </Celda>
      <Celda numero>
        {ingrediente.densidad_g_ml != null ? (
          <Text fontSize="sm">{formatoCantidad(ingrediente.densidad_g_ml)}</Text>
        ) : (
          <Text fontSize="sm" color="fg.subtle">—</Text>
        )}
      </Celda>
      <Celda numero>
        {ingrediente.peso_unitario_g != null ? (
          <Text fontSize="sm">{formatoCantidad(ingrediente.peso_unitario_g)}</Text>
        ) : (
          <Text fontSize="sm" color="fg.subtle">—</Text>
        )}
      </Celda>
      <Celda>
        {ingrediente.proveedores?.length ? (
          // Un proveedor por renglón hacía filas de 8 renglones: van en una
          // línea (dos como mucho) y la lista completa queda en el `title`.
          <TextoTruncado
            texto={ingrediente.proveedores.map((proveedor) => proveedor.nombre).join(", ")}
            max={90}
            color="tabla.textoSecundario"
            title={ingrediente.proveedores.map((proveedor) => proveedor.nombre).join(", ")}
          />
        ) : <Text fontSize="sm" color="fg.subtle">Sin asociar</Text>}
      </Celda>
      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {ingrediente.activo && (
            <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(ingrediente)} />
          )}
          {ingrediente.activo && (
            <BotonAccion accion="nutricion" label="Datos nutricionales" onClick={() => onNutricion(ingrediente)} />
          )}
          {ingrediente.activo ? (
            <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(ingrediente)} />
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(ingrediente)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}