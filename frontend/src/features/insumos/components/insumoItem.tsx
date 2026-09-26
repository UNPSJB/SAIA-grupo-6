import { Button, HStack, Table } from "@chakra-ui/react";
import { TIPOS_UNIDAD, type Insumo } from "../types/insumo";

const TEAL = "#468189";

interface InsumoItemProps {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
}

export function InsumoItem({ insumo, onEdit, onDelete, onReactivar }: InsumoItemProps) {
  const tipoLabel =
    TIPOS_UNIDAD.find((t) => t.value === insumo.tipo)?.label ?? insumo.tipo;

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: insumo.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{insumo.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {insumo.nombre}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {tipoLabel}
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