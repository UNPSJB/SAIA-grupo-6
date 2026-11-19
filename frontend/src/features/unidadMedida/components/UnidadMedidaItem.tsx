import { HStack, Table } from "@chakra-ui/react";
import type { UnidadMedida } from "../types/unidadMedida";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  PildoraNeutra,
} from "../../../components/ui/patrones";
import { formatoCantidad } from "../../../common/utils/numeros";

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

      <Celda>
        <DatoPrincipal titulo={unidad.nombre} />
      </Celda>

      <Celda center><PildoraNeutra mono>{unidad.simbolo}</PildoraNeutra></Celda>

      <Celda center><PildoraNeutra>{unidad.tipo}</PildoraNeutra></Celda>

      <Celda numero>{formatoCantidad(unidad.factor_a_base)}</Celda>

      <Celda center>
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