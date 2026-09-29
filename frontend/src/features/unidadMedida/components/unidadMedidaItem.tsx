import { Button, HStack, Table } from "@chakra-ui/react";
import type { UnidadMedida } from "../types/unidadMedida";

interface UnidadMedidaItemProps {
  unidad: UnidadMedida;
  onEdit: (unidad: UnidadMedida) => void;
  onDelete: (unidad: UnidadMedida) => void;
  onReactivar: (unidad: UnidadMedida) => void;
}

const TEAL = "#468189";

export function UnidadMedidaItem({
  unidad,
  onEdit,
  onDelete,
  onReactivar,
}: UnidadMedidaItemProps) {
  return (
    <Table.Row
      style={{
        borderBottom: "1px solid #eee",
        opacity: unidad.activo ? 1 : 0.65,
      }}
    >
      <Table.Cell
        color={TEAL}
        fontWeight="bold"
        fontSize="16px"
        style={{ padding: "12px" }}
      >
        #{unidad.id}
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {unidad.nombre}
      </Table.Cell>

      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>
        {unidad.simbolo}
      </Table.Cell>

      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {unidad.activo ? (
            <>
              <Button
                bg="#f0ad4e"
                color="white"
                fontSize="15px"
                fontWeight="normal"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
                _hover={{ bg: "#ec971f" }}
                onClick={() => onEdit(unidad)}
              >
                Modificar
              </Button>

              <Button
                bg="#d9534f"
                color="white"
                fontSize="15px"
                fontWeight="normal"
                style={{
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                }}
                _hover={{ bg: "#c9302c" }}
                onClick={() => onDelete(unidad)}
              >
                Eliminar
              </Button>
            </>
          ) : (
            <Button
              bg="#28a745"
              color="white"
              fontSize="15px"
              fontWeight="normal"
              style={{
                border: "none",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
              _hover={{ bg: "#218838" }}
              onClick={() => onReactivar(unidad)}
            >
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}
