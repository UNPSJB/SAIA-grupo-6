import { Table, Button, HStack, Badge } from "@chakra-ui/react";
import type { PlanLimpieza } from "../types/planLimpieza";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  PELIGRO,
  TEAL,
} from "../../../common/theme/tokens";

interface PlanLimpiezaItemProps {
  plan: PlanLimpieza;
  nombreEquipo: string;
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
  onReactivar: (plan: PlanLimpieza) => void;
}

export function PlanLimpiezaItem({
  plan,
  nombreEquipo,
  onEdit,
  onDelete,
  onReactivar,
}: PlanLimpiezaItemProps) {
  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        opacity: plan.activo ? 1 : 0.65,
      }}
    >
      <Table.Cell
        color={TEAL}
        fontWeight="bold"
        fontSize="16px"
        style={{ padding: "12px" }}
      >
        #{plan.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {plan.nombre}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {plan.tareas
          .map(
            (tarea) =>
              `${tarea.nombre} (cada ${tarea.frecuencia} ${tarea.frecuencia === 1 ? "día" : "días"})`,
          )
          .join(", ")}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {nombreEquipo}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <Badge
          colorPalette={plan.activo ? "green" : "gray"}
          borderRadius="6px"
          px="8px"
          py="4px"
        >
          {plan.activo ? "Activo" : "Inactivo"}
        </Badge>
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {plan.activo && (
            <Button
              bg={ADVERTENCIA}
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: ADVERTENCIA_HOVER }}
              onClick={() => onEdit(plan)}
            >
              Modificar
            </Button>
          )}

          {plan.activo ? (
            <Button
              bg={PELIGRO}
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: PELIGRO }}
              onClick={() => onDelete(plan)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg={EXITO}
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: EXITO_HOVER }}
              onClick={() => onReactivar(plan)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
