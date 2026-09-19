import { Box, Table, Text } from "@chakra-ui/react";
import { PersonalItem } from "./PersonalItem";
import type { Persona } from "../types/personal";

interface PersonalTableProps {
  personales: Persona[];
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
}

const TEAL = "#468189";

export function PersonalTable({ personales, onEdit, onDelete }: PersonalTableProps) {
  if (personales.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay personal cargado.</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>ID</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Nombre</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>DNI</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Permisos</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>Detalle</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {personales.map((persona) => (
            <PersonalItem key={persona.id} persona={persona} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}