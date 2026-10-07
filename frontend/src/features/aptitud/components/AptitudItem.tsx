import { Button, HStack, Table, Text } from "@chakra-ui/react";
import type { Aptitud } from "../types/aptitud";
import {
  ADVERTENCIA,
  ADVERTENCIA_HOVER,
  EXITO,
  EXITO_HOVER,
  PELIGRO,
  PELIGRO_HOVER,
  TEAL,
} from "../../../common/theme/tokens";

interface AptitudItemProps {
  aptitud: Aptitud;
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudItem({ aptitud, onEdit, onDelete, onReactivar }: AptitudItemProps) {
  return (
    <Table.Row style={{ borderBottom: "1px solid #eee", opacity: aptitud.activo ? 1 : 0.65 }}>
      <Table.Cell color={TEAL} fontWeight="bold" fontSize="16px" style={{ padding: "12px" }}>
        #{aptitud.id}
      </Table.Cell>
      <Table.Cell fontSize="16px" style={{ padding: "12px" }}>{aptitud.nombre}</Table.Cell>
      <Table.Cell fontSize="14px" style={{ padding: "12px" }}>
        {aptitud.descripcion || <Text as="span" color="gray.400" fontStyle="italic">Sin descripción</Text>}
      </Table.Cell>
      <Table.Cell style={{ padding: "12px", textAlign: "center" }}>
        <HStack justify="center" style={{ gap: "10px" }}>
          {aptitud.activo ? (
            <>
              <Button bg={ADVERTENCIA} color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: ADVERTENCIA_HOVER }} onClick={() => onEdit(aptitud)}>
                Modificar
              </Button>
              <Button bg={PELIGRO} color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: PELIGRO_HOVER }} onClick={() => onDelete(aptitud)}>
                Eliminar
              </Button>
            </>
          ) : (
            <Button bg={EXITO} color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: EXITO_HOVER }} onClick={() => onReactivar(aptitud)}>
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}