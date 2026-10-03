import { Box, Table, Text } from "@chakra-ui/react";
import { AptitudItem } from "./AptitudItem";
import type { Aptitud } from "../types/aptitud";

interface AptitudTableProps {
  aptitudes: Aptitud[];
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

const TEAL = "#468189";

export function AptitudTable({ aptitudes, onEdit, onDelete, onReactivar }: AptitudTableProps) {
  if (aptitudes.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay aptitudes registradas.</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader color="white" fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>ID</Table.ColumnHeader>
            <Table.ColumnHeader color="white" fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Nombre</Table.ColumnHeader>
            <Table.ColumnHeader color="white" fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Descripción</Table.ColumnHeader>
            <Table.ColumnHeader color="white" fontWeight="normal" fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {aptitudes.map((aptitud) => (
            <AptitudItem key={aptitud.id} aptitud={aptitud} onEdit={onEdit} onDelete={onDelete} onReactivar={onReactivar} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}