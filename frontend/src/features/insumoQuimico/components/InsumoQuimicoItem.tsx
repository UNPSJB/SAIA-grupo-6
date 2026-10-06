import { Button, HStack, Table } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimico,
} from "../types/insumoQuimico";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  PELIGRO,
  PELIGRO_HOVER,
  TEAL,
} from "../../../common/theme/tokens";

interface InsumoQuimicoItemProps {
  insumo: InsumoQuimico;
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

export function InsumoQuimicoItem({
  insumo,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoQuimicoItemProps) {
  const tipoLabel =
    TIPOS_QUIMICOS.find((t) => t.value === insumo.tipo)?.label ?? insumo.tipo;

  const unidadLabel = insumo.unidad_medida
    ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})`
    : `#${insumo.unidad_medida_id}`;

  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        opacity: insumo.activo ? 1 : 0.65,
      }}
    >
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

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {unidadLabel}
      </Table.Cell>

      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {insumo.activo ? (
            <>
              <Button
                bg={ADVERTENCIA}
                color="white"
                fontSize="15px"
                fontWeight="normal"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
                _hover={{ bg: ADVERTENCIA_HOVER }}
                onClick={() => onEdit(insumo)}
              >
                Modificar
              </Button>

              <Button
                bg={PELIGRO}
                color="white"
                fontSize="15px"
                fontWeight="normal"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
                _hover={{ bg: PELIGRO_HOVER }}
                onClick={() => onDelete(insumo)}
              >
                Eliminar
              </Button>
            </>
          ) : (
            <Button
              bg={EXITO}
              color="white"
              fontSize="15px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: EXITO_HOVER }}
              onClick={() => onReactivar(insumo)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
