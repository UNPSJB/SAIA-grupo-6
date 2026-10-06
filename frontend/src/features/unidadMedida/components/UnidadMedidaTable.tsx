import { Box, Table, Text } from "@chakra-ui/react";
import { UnidadMedidaItem } from "./UnidadMedidaItem";
import type { UnidadMedida } from "../types/unidadMedida";
import { TEAL } from "../../../common/theme/tokens";

interface UnidadMedidaTableProps {
  unidades: UnidadMedida[];
  onEdit: (unidad: UnidadMedida) => void;
  onDelete: (unidad: UnidadMedida) => void;
  onReactivar: (unidad: UnidadMedida) => void;
}

export function UnidadMedidaTable({
  unidades,
  onEdit,
  onDelete,
  onReactivar,
}: UnidadMedidaTableProps) {
  if (unidades.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay unidades de medida registradas.</Text>
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
              Símbolo
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
          {unidades.map((unidad) => (
            <UnidadMedidaItem
              key={unidad.id}
              unidad={unidad}
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
