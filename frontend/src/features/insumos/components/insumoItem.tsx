import { Table, Button, HStack } from "@chakra-ui/react";
import { TIPOS_UNIDAD, type Insumo } from "../types/insumo";

interface InsumoItemProps {
  insumo: Insumo;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
}

const TEAL = "#468189";

export function InsumoItem({ insumo, onEdit, onDelete }: InsumoItemProps) {
  const tipoLabel =
    TIPOS_UNIDAD.find((t) => t.value === insumo.tipo)?.label ?? insumo.tipo;

  return (
    <Table.Row style={{ borderBottom: "1px solid #eee" }}>
      <Table.Cell
        color={TEAL}
        fontWeight="bold"
        fontSize="16px"
        style={{ padding: "12px" }}
      >
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
          <Button
            bg="#f0ad4e"
            color="white"
            fontSize="16px"
            fontWeight="normal"
            style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
            _hover={{ bg: "#f0ad4e" }}
            onClick={() => onEdit(insumo)}
          >
            Modificar
          </Button>
          <Button
            bg="#d9534f"
            color="white"
            fontSize="16px"
            fontWeight="normal"
            style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
            _hover={{ bg: "#d9534f" }}
            onClick={() => onDelete(insumo)}
          >
            Eliminar
          </Button>
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
