import { Button, HStack, Table, Text } from "@chakra-ui/react";
import type { Aptitud } from "../types/aptitud";

interface AptitudItemProps {
  aptitud: Aptitud;
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

const TEAL = "#468189";

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
              <Button bg="#f0ad4e" color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: "#ec971f" }} onClick={() => onEdit(aptitud)}>
                Modificar
              </Button>
              <Button bg="#d9534f" color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: "#c9302c" }} onClick={() => onDelete(aptitud)}>
                Eliminar
              </Button>
            </>
          ) : (
            <Button bg="#28a745" color="white" fontSize="15px" fontWeight="normal" style={{ border: "none", padding: "6px 12px", borderRadius: "4px" }} _hover={{ bg: "#218838" }} onClick={() => onReactivar(aptitud)}>
              Reactivar
            </Button>
          )}
        </HStack>
      </Table.Cell>
    </Table.Row>
  );
}