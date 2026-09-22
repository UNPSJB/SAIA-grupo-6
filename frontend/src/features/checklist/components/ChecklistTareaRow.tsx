import { HStack, Table, Text, Spinner } from "@chakra-ui/react";
import type { ChecklistTareaItem } from "../types/checklist";

interface ChecklistTareaRowProps {
  tarea: ChecklistTareaItem;
  isLoading: boolean;
  onToggle: (tareaId: number, estadoActual: boolean) => void;
}

const TEAL = "#468189";

export function ChecklistTareaRow({
  tarea,
  isLoading,
  onToggle,
}: ChecklistTareaRowProps) {
  const horaCompletado = tarea.fecha_completado
    ? new Date(tarea.fecha_completado).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        backgroundColor: tarea.completado ? "#f8fff9" : "transparent",
        transition: "background-color 0.2s",
      }}
    >
      <Table.Cell width="60px" textAlign="center" style={{ padding: "12px" }}>
        {isLoading ? (
          <Spinner size="xs" color={TEAL} />
        ) : (
          <input
            type="checkbox"
            checked={tarea.completado}
            onChange={() => onToggle(tarea.id, tarea.completado)}
            style={{
              width: "18px",
              height: "18px",
              cursor: "pointer",
              accentColor: TEAL,
            }}
          />
        )}
      </Table.Cell>
      <Table.Cell
        style={{
          padding: "12px",
          textDecoration: tarea.completado ? "line-through" : "none",
          color: tarea.completado ? "#777" : "#333",
          fontWeight: 500,
        }}
      >
        {tarea.nombre}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "right" }}>
        {tarea.completado ? (
          <HStack justify="flex-end" gap="6px">
            <Text fontSize="13px" color="#28a745" fontWeight="bold">
              ✓ Completada
            </Text>
            {horaCompletado && (
              <Text fontSize="12px" color="#888">
                ({horaCompletado})
              </Text>
            )}
          </HStack>
        ) : (
          <Text fontSize="13px" color="#888">
            Pendiente
          </Text>
        )}
      </Table.Cell>
    </Table.Row>
  );
}
