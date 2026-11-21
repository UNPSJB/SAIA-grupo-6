import { Badge, HStack, Stack, Table, Text } from "@chakra-ui/react";
import type { Insumo } from "../types/insumo";
import { formatoCantidad } from "../../../common/utils/numeros";
import { etiquetaAditivo } from "../../aditivos/types/aditivo";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  PildoraNeutra,
  TextoTruncado,
} from "../../../components/ui/patrones";

interface InsumoItemProps {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
  onNutricion: (insumo: Insumo) => void;
}

export function InsumoItem({
  insumo,
  onEdit,
  onDelete,
  onReactivar,
  onNutricion,
}: InsumoItemProps) {
  const unidadLabel = insumo.unidad_medida
    ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})`
    : `#${insumo.unidad_medida_id}`;

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={insumo.activo ? 1 : 0.65}>
      <Celda>
        <DatoPrincipal titulo={insumo.nombre} />
      </Celda>
      <Celda>
        <Stack gap="1" align="flex-start">
          <Badge
            colorPalette={insumo.tipo === "aditivo" ? "purple" : "gray"}
            variant="subtle"
          >
            {insumo.tipo === "aditivo" ? "Aditivo" : "Ingrediente"}
          </Badge>
          {insumo.aditivo && (
            <Text fontSize="xs" color="fg.muted">
              {etiquetaAditivo(insumo.aditivo)}
            </Text>
          )}
        </Stack>
      </Celda>
      <Celda center>
        <span title={unidadLabel}>
          <PildoraNeutra>{insumo.unidad_medida?.simbolo ?? unidadLabel}</PildoraNeutra>
        </span>
      </Celda>
      <Celda numero>
        {insumo.densidad_g_ml != null ? (
          <Text fontSize="sm">{formatoCantidad(insumo.densidad_g_ml)}</Text>
        ) : (
          <Text fontSize="sm" color="fg.subtle">—</Text>
        )}
      </Celda>
      <Celda numero>
        {insumo.peso_unitario_g != null ? (
          <Text fontSize="sm">{formatoCantidad(insumo.peso_unitario_g)}</Text>
        ) : (
          <Text fontSize="sm" color="fg.subtle">—</Text>
        )}
      </Celda>
      <Celda>
        {insumo.proveedores?.length ? (
          // Un proveedor por renglón hacía filas de 8 renglones: van en una
          // línea (dos como mucho) y la lista completa queda en el `title`.
          <TextoTruncado
            texto={insumo.proveedores.map((proveedor) => proveedor.nombre).join(", ")}
            max={90}
            color="tabla.textoSecundario"
            title={insumo.proveedores.map((proveedor) => proveedor.nombre).join(", ")}
          />
        ) : <Text fontSize="sm" color="fg.subtle">Sin asociar</Text>}
      </Celda>
      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {insumo.activo && (
            <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(insumo)} />
          )}
          {insumo.activo && (
            <BotonAccion accion="nutricion" label="Datos nutricionales" onClick={() => onNutricion(insumo)} />
          )}
          {insumo.activo ? (
            <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(insumo)} />
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(insumo)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}