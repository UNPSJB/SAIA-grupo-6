import { Table, Button, HStack } from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

interface ElementoLimpiezaItemProps {
  elemento: ElementoLimpieza;
  onEdit: (elemento: ElementoLimpieza) => void;
  onDelete: (elemento: ElementoLimpieza) => void;
  onReactivar: (elemento: ElementoLimpieza) => void;
}

const TEAL = "#468189";

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
          ? new Date(elemento.fecha_ultimo_recambio).toLocaleDateString("es-AR")
          : "-"}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {elemento.frecuencia_recambio_dias ?? "Sin definir"}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {elemento.activo && (
            <Button
              bg="#f0ad4e" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#f0ad4e" }} onClick={() => onEdit(elemento)}
            >
              Modificar
            </Button>
          )}
          {elemento.activo ? (
            <Button
              bg="#d9534f" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#d9534f" }} onClick={() => onDelete(elemento)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg="#28a745" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#218838" }} onClick={() => onReactivar(elemento)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}