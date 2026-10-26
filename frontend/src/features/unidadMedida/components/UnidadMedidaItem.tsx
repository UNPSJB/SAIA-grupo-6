import { HStack, Table } from "@chakra-ui/react";
import type { UnidadMedida } from "../types/unidadMedida";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface UnidadMedidaItemProps {
  unidad: UnidadMedida;
  onEdit: (unidad: UnidadMedida) => void;
  onDelete: (unidad: UnidadMedida) => void;
  onReactivar: (unidad: UnidadMedida) => void;
}

export function UnidadMedidaItem({
  unidad,
  onEdit,
  onDelete,
  onReactivar,
}: UnidadMedidaItemProps) {
  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={unidad.activo ? 1 : 0.65}
    >

      <Celda p="3">
        <TextoTruncado texto={unidad.nombre} />
      </Celda>

      <Celda p="3">{unidad.simbolo}</Celda>

      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {unidad.activo ? (
            <>
              <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(unidad)} />
              <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(unidad)} />
            </>
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(unidad)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}