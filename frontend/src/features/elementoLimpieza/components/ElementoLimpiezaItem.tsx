import { HStack, Table } from "@chakra-ui/react";
import { formatoFecha } from "../../../common/utils/fechas";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

interface ElementoLimpiezaItemProps {
  elemento: ElementoLimpieza;
  onEdit: (elemento: ElementoLimpieza) => void;
  onDelete: (elemento: ElementoLimpieza) => void;
  onReactivar: (elemento: ElementoLimpieza) => void;
}

export function ElementoLimpiezaItem({
  elemento,
  onEdit,
  onDelete,
  onReactivar,
}: ElementoLimpiezaItemProps) {
  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={elemento.activo ? 1 : 0.65}
    >
      <Celda p="3">{elemento.nombre}</Celda>
      <Celda p="3">
        {elemento.fecha_ultimo_recambio
          ? formatoFecha(elemento.fecha_ultimo_recambio)
          : "-"}
      </Celda>
      <Celda p="3">{elemento.frecuencia_recambio_dias ?? "Sin definir"}</Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {elemento.activo && (
            <BotonTabla accion="editar" onClick={() => onEdit(elemento)}>
              Modificar
            </BotonTabla>
          )}
          {elemento.activo ? (
            <BotonTabla accion="eliminar" onClick={() => onDelete(elemento)}>
              Eliminar
            </BotonTabla>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(elemento)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}