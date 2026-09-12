import { Box, Table, Text } from "@chakra-ui/react";
import { InsumoItem } from "./insumoItem";
import type { Insumo } from "../types/insumo";

interface InsumoTableProps {
  insumos: Insumo[];
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
}

const TEAL = "#468189";

export function InsumoTable({ insumos, onEdit, onDelete }: InsumoTableProps) {
  if (insumos.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay insumos cargados.</Text>
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
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              ID
            </Table.ColumnHeader>
            <Table.ColumnHeader
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Nombre
            </Table.ColumnHeader>
            <Table.ColumnHeader
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Tipo
            </Table.ColumnHeader>
            <Table.ColumnHeader
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
            <InsumoItem
              key={insumo.id}
              insumo={insumo}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
