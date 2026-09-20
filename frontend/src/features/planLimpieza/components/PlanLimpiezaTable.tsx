import { Box, Table, Text } from "@chakra-ui/react";
import { PlanLimpiezaItem } from "./PlanLimpiezaItem";
import type { EquipoOption, PlanLimpieza } from "../types/planLimpieza";

interface PlanLimpiezaTableProps {
  planes: PlanLimpieza[];
  equipos: EquipoOption[];
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
}

const TEAL = "#468189";

export function PlanLimpiezaTable({ planes, equipos, onEdit, onDelete }: PlanLimpiezaTableProps) {
  if (planes.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay planes de limpieza cargados.</Text>
      </Box>
    );
  }

  const nombreEquipo = (id: number) => equipos.find((e) => e.id === id)?.nombre || `#${id}`;

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflow: "hidden" }}>
      <Table.Root variant="outline" style={{ width: "100%", borderCollapse: "collapse" }}>
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>ID</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Nombre</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Tareas</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Equipo</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Frecuencia</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>Estado</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px", textAlign: "center" }}>Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {planes.map((plan) => (
            <PlanLimpiezaItem
              key={plan.id}
              plan={plan}
              nombreEquipo={nombreEquipo(plan.equipo_id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
