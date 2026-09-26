import { Table, Button, HStack, Badge } from "@chakra-ui/react";
import type { PlanLimpieza } from "../types/planLimpieza";

interface PlanLimpiezaItemProps {
  plan: PlanLimpieza;
  nombreEquipo: string;
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
  onReactivar: (plan: PlanLimpieza) => void;
}

const TEAL = "#468189";

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
              bg="#f0ad4e"
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: "#f0ad4e" }}
              onClick={() => onEdit(plan)}
            >
              Modificar
            </Button>
          )}

          {plan.activo ? (
            <Button
              bg="#d9534f"
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: "#d9534f" }}
              onClick={() => onDelete(plan)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg="#28a745"
              color="white"
              fontSize="16px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: "#218838" }}
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
