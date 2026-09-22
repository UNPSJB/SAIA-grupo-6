import { Box, Heading, Table, Badge, HStack, Text } from "@chakra-ui/react";
import { ChecklistTareaRow } from "./ChecklistTareaRow";
import type { ChecklistPlanItem } from "../types/checklist";

interface ChecklistPlanGroupProps {
  plan: ChecklistPlanItem;
  actualizandoId: number | null;
  onToggle: (tareaId: number, estadoActual: boolean) => void;
}

const TEAL = "#468189";

export function ChecklistPlanGroup({
  plan,
  actualizandoId,
  onToggle,
}: ChecklistPlanGroupProps) {
  const total = plan.tareas.length;
  const completadas = plan.tareas.filter((t) => t.completado).length;
  const todoListo = total > 0 && completadas === total;

  return (
    <Box
      bg="white"
      style={{
        borderRadius: "10px",
        overflow: "hidden",
        marginBottom: "24px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        border: "1px solid #e2e8f0",
      }}
    >
      <HStack
        justify="space-between"
        style={{
          backgroundColor: "#f7fafc",
          padding: "14px 20px",
          borderBottom: "1px solid #edf2f7",
        }}
      >
        <HStack gap="10px">
          <Heading as="h3" size="sm" color="#333" margin="0">
            {plan.plan_nombre}
          </Heading>
          {todoListo && (
            <Badge colorPalette="green" borderRadius="4px">
              Completado
            </Badge>
          )}
        </HStack>
        <Text fontSize="13px" fontWeight="bold" color={TEAL}>
          {completadas}/{total} tareas
        </Text>
      </HStack>

      <Table.Root
        variant="line"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <Table.Body>
          {plan.tareas.map((tarea) => (
            <ChecklistTareaRow
              key={tarea.id}
              tarea={tarea}
              isLoading={actualizandoId === tarea.id}
              onToggle={onToggle}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
