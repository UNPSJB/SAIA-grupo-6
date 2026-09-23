import { Button, HStack, Table } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  UNIDADES_MEDIDA,
  type InsumoQuimico,
} from "../types/insumoQuimico";

interface InsumoQuimicoItemProps {
  insumo: InsumoQuimico;
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

const TEAL = "#468189";

export function InsumoQuimicoItem({
  insumo,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoQuimicoItemProps) {
  const tipoLabel =
    TIPOS_QUIMICOS.find((t) => t.value === insumo.tipo)?.label ?? insumo.tipo;
  const unidadLabel =
    UNIDADES_MEDIDA.find((u) => u.value === insumo.unidad_medida)?.label ??
    insumo.unidad_medida;

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
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {unidadLabel}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {insumo.activo ? (
            <>
              <Button
                bg="#f0ad4e" color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
                _hover={{ bg: "#ec971f" }} onClick={() => onEdit(insumo)}
              >
                Modificar
              </Button>
              <Button
                bg="#d9534f" color="white" fontSize="15px" fontWeight="normal"
                style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }}
                _hover={{ bg: "#c9302c" }} onClick={() => onDelete(insumo)}
              >
                Eliminar
              </Button>
            </>
          ) : (
            <Button
              bg="#28a745" color="white" fontSize="15px" fontWeight="normal"
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