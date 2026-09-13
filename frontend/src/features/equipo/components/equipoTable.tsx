import { Box, Table, Text } from "@chakra-ui/react";
import { EquipoItem } from "./equipoItem";
import type { Equipo } from "../types/equipo";

interface EquipoTableProps {
  equipos: Equipo[];
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
}

const TEAL = "#468189";

export function EquipoTable({ equipos, onEdit, onDelete }: EquipoTableProps) {
  if (equipos.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay equipos cargados.</Text>
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
              style={{ padding: "12px" }}
            >
                Ubicación
            </Table.ColumnHeader>
            <Table.ColumnHeader
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
                Estado
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
          {equipos.map((equipo) => (
            <EquipoItem
              key={equipo.id}
              equipo={equipo}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
