import { Badge, Button, HStack, Table } from "@chakra-ui/react";

import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

interface PlanCalibracionMantenimientoItemProps {
  plan: PlanCalibracionMantenimiento;
  nombreEquipo: string;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
}

const TEAL = "#468189";

function formatearFecha(fecha: string) {
  return new Date(`${fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR");
}

function obtenerEstado(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return { etiqueta: "Vencido", color: "red" };
  }
  if (diasRestantes <= 3) {
    return { etiqueta: "Próximo a vencer", color: "orange" };
  }
  return { etiqueta: "Vigente", color: "green" };
}

export function PlanCalibracionMantenimientoItem({
  plan,
  nombreEquipo,
  onEdit,
}: PlanCalibracionMantenimientoItemProps) {
  const estado = obtenerEstado(plan.dias_restantes);

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee" }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{plan.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {nombreEquipo}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {formatearFecha(plan.fecha_ultima_intervencion)}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        Cada {plan.periodicidad_dias} {plan.periodicidad_dias === 1 ? "día" : "días"}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {formatearFecha(plan.proxima_fecha_vencimiento)}
      </Table.Cell>
      <Table.Cell fontSize="16px" textAlign="center" style={{ padding: "12px" }}>
        {plan.dias_restantes}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <Badge colorPalette={estado.color} borderRadius="6px" px="8px" py="4px">
          {estado.etiqueta}
        </Badge>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center">
          <Button
            bg="#f0ad4e"
            color="white"
            fontSize="16px"
            fontWeight="normal"
            style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
            _hover={{ bg: "#f0ad4e" }}
            onClick={() => onEdit(plan)}
          >
            Modificar
          </Button>
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
