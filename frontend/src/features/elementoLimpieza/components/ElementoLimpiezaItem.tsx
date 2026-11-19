import { HStack, Table } from "@chakra-ui/react";
import { formatoFecha } from "../../../common/utils/fechas";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  CantidadConUnidad,
} from "../../../components/ui/patrones";

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
      <Celda>
        <DatoPrincipal titulo={elemento.nombre} />
      </Celda>
      <Celda whiteSpace="nowrap">
        {elemento.fecha_ultimo_recambio
          ? formatoFecha(elemento.fecha_ultimo_recambio)
          : "-"}
      </Celda>
      <Celda numero>
        {elemento.frecuencia_recambio_dias != null ? (
          <CantidadConUnidad valor={elemento.frecuencia_recambio_dias} unidad="días" />
        ) : (
          "Sin definir"
        )}
      </Celda>
      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {elemento.activo && (
            <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(elemento)} />
          )}
          {elemento.activo ? (
            <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(elemento)} />
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(elemento)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}