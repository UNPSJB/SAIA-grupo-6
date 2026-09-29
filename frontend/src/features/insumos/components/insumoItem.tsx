import { Button, HStack, Table } from "@chakra-ui/react";
import type { Insumo } from "../types/insumo";

interface InsumoItemProps {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
}

const TEAL = "#468189";

export function InsumoItem({ insumo, onEdit, onDelete, onReactivar }: InsumoItemProps) {
  const unidadLabel = insumo.unidad_medida
    ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})`
    : `#${insumo.unidad_medida_id}`;

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: insumo.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{insumo.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {insumo.nombre}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {unidadLabel}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {insumo.activo && (
            <Button
              bg="#f0ad4e" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#f0ad4e" }} onClick={() => onEdit(insumo)}
            >
              Modificar
            </Button>
          )}

          {insumo.activo ? (
            <Button
              bg="#d9534f" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#d9534f" }} onClick={() => onDelete(insumo)}
            >
              Eliminar
            </Button>
          ) : (
            <Button
              bg="#28a745" color="white" fontSize="16px" fontWeight="normal"
              style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
              _hover={{ bg: "#218838" }} onClick={() => onReactivar(insumo)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
