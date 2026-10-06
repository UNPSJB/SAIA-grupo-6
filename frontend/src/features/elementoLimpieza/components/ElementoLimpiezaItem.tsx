import { formatoFecha } from "../../../common/utils/fechas";
import { Table, Button, HStack } from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  PELIGRO,
  TEAL,
} from "../../../common/theme/tokens";

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
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: elemento.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{elemento.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {elemento.nombre}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {elemento.fecha_ultimo_recambio
          ? formatoFecha(elemento.fecha_ultimo_recambio)
          : "-"}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {elemento.frecuencia_recambio_dias ?? "Sin definir"}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {elemento.activo && (
            <Button
              bg={ADVERTENCIA} color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: ADVERTENCIA_HOVER }} onClick={() => onEdit(elemento)}
            >
              Modificar
            </Button>
          )}
          {elemento.activo ? (
            <Button
              bg={PELIGRO} color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: PELIGRO }} onClick={() => onDelete(elemento)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg={EXITO} color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: EXITO_HOVER }} onClick={() => onReactivar(elemento)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}