import { Box, Table, Text } from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import { ElementoLimpiezaItem } from "./elementoLimpiezaItem";

interface ElementoLimpiezaTableProps {
  elementos: ElementoLimpieza[];
  onEdit: (elemento: ElementoLimpieza) => void;
  onDelete: (elemento: ElementoLimpieza) => void;
  onReactivar: (elemento: ElementoLimpieza) => void;
}

const TEAL = "#468189";

export function ElementoLimpiezaTable({
  elementos,
  onEdit,
  onDelete,
  onReactivar,
}: ElementoLimpiezaTableProps) {
  if (elementos.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay elementos de limpieza para mostrar.</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>
              ID
            </Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>
              Nombre
            </Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>
              Último Recambio
            </Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>
              Frecuencia (Días)
            </Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" textAlign="center" style={{ padding: "12px" }}>
              Acciones
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {elementos.map((elemento) => (
            <ElementoLimpiezaItem
              key={elemento.id}
              elemento={elemento}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}