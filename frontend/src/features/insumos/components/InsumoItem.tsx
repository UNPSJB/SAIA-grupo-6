import { HStack, Table } from "@chakra-ui/react";
import type { Insumo } from "../types/insumo";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

interface InsumoItemProps {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
}

export function InsumoItem({
  insumo,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoItemProps) {
  const unidadLabel = insumo.unidad_medida
    ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})`
    : `#${insumo.unidad_medida_id}`;

  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={insumo.activo ? 1 : 0.65}>
      <Celda p="3">{insumo.nombre}</Celda>
      <Celda p="3">{unidadLabel}</Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {insumo.activo && (
            <BotonTabla accion="editar" onClick={() => onEdit(insumo)}>
              Modificar
            </BotonTabla>
          )}
          {insumo.activo ? (
            <BotonTabla accion="eliminar" onClick={() => onDelete(insumo)}>
              Eliminar
            </BotonTabla>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(insumo)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}