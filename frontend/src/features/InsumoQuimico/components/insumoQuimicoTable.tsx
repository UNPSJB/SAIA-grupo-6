import { Box, Table, Text } from "@chakra-ui/react";
import { InsumoQuimicoItem } from "./insumoQuimicoItem";
import type { InsumoQuimico } from "../types/insumoQuimico";

interface InsumoQuimicoTableProps {
  insumos: InsumoQuimico[];
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

const TEAL = "#468189";

export function InsumoQuimicoTable({
  insumos,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoQuimicoTableProps) {
  if (insumos.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay insumos químicos registrados.</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root
        variant="outline"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              ID
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Nombre
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Tipo
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Unidad Medida
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px", textAlign: "center" }}
            >
              Acciones
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {insumos.map((insumo) => (
            <InsumoQuimicoItem
              key={insumo.id}
              insumo={insumo}
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