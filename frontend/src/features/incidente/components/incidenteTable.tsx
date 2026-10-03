import { Box, Table, Text } from "@chakra-ui/react";
import { IncidenteItem } from "./incidenteItem";
import type { Incidente } from "../types/incidente";

interface IncidenteTableProps {
  incidentes: Incidente[];
  onDelete: (incidente: Incidente) => void;
}

const TEAL = "#468189";

export function IncidenteTable({ incidentes, onDelete }: IncidenteTableProps) {
  if (incidentes.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay incidentes registrados.</Text>
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
              style={{ padding: "12px", width: "220px" }}
            >
              Descripción
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
              Reportado por
            </Table.ColumnHeader>

            <Table.ColumnHeader
              color="white"
              fontWeight="normal"
              fontSize="16px"
              style={{ padding: "12px" }}
            >
              Fecha
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
          {incidentes.map((incidente) => (
            <IncidenteItem
              key={incidente.id}
              incidente={incidente}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
