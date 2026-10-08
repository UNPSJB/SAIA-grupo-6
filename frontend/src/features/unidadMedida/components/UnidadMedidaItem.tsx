import { HStack, Table } from "@chakra-ui/react";
import type { UnidadMedida } from "../types/unidadMedida";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

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
      borderColor="gray.100"
      opacity={unidad.activo ? 1 : 0.65}
    >
      <Celda p="3" color="brand.500" fontWeight="bold" fontSize="md">
        #{unidad.id}
      </Celda>

      <Celda p="3" fontSize="md">
        {unidad.nombre}
      </Celda>

      <Celda p="3" fontSize="md">
        {unidad.simbolo}
      </Celda>

      <Celda p="3" center>
        <HStack justify="center" gap="2">
          {unidad.activo ? (
            <>
              <BotonTabla accion="editar" onClick={() => onEdit(unidad)}>
                Modificar
              </BotonTabla>
              <BotonTabla accion="eliminar" onClick={() => onDelete(unidad)}>
                Eliminar
              </BotonTabla>
            </>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(unidad)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}