import { Box, Table, Text } from "@chakra-ui/react";

import { PlanCalibracionMantenimientoItem } from "./PlanCalibracionMantenimientoItem";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import { TEAL } from "../../../common/theme/tokens";

interface PlanCalibracionMantenimientoTableProps {
  planes: PlanCalibracionMantenimiento[];
  nombresEquipos: Map<number, string>;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
  onDelete: (plan: PlanCalibracionMantenimiento) => void;
}

export function PlanCalibracionMantenimientoTable({
  planes,
  nombresEquipos,
  onEdit,
  onDelete,
}: PlanCalibracionMantenimientoTableProps) {
  if (planes.length === 0) {
    return (
      <Box bg="white" style={{ borderRadius: "8px" }} p={8} textAlign="center">
        <Text color="gray.500">No hay planes para mostrar.</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" style={{ borderRadius: "8px", overflowX: "auto" }}>
      <Table.Root variant="outline" style={{ minWidth: "1200px", borderCollapse: "collapse" }}>
        <Table.Header>
          <Table.Row bg={TEAL} style={{ color: "white", textAlign: "left" }}>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>ID</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Equipo</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Tipo</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Última intervención</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Periodicidad</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" style={{ padding: "12px" }}>Próximo vencimiento</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" textAlign="center" style={{ padding: "12px" }}>Días restantes</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" textAlign="center" style={{ padding: "12px" }}>Estado</Table.ColumnHeader>
            <Table.ColumnHeader fontWeight="normal" fontSize="16px" textAlign="center" style={{ padding: "12px" }}>Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {planes.map((plan) => (
            <PlanCalibracionMantenimientoItem
              key={plan.id}
              plan={plan}
              nombreEquipo={nombresEquipos.get(plan.equipo_id) || `Equipo #${plan.equipo_id}`}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
