import { Button, HStack, Table, Text } from "@chakra-ui/react";
import type { Aptitud } from "../types/aptitud";
import { Celda } from "../../../components/ui/patrones";

interface AptitudItemProps {
  aptitud: Aptitud;
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudItem({ aptitud, onEdit, onDelete, onReactivar }: AptitudItemProps) {
  return (
    <Table.Row borderBottom="1px solid" borderColor="gray.100" opacity={aptitud.activo ? 1 : 0.65}>
      <Celda p="3" color="brand.500" fontWeight="bold" fontSize="16px">
        #{aptitud.id}
      </Celda>
      <Celda p="3" fontSize="16px">{aptitud.nombre}</Celda>
      <Celda p="3" fontSize="14px">
        {aptitud.descripcion || <Text as="span" color="gray.400" fontStyle="italic">Sin descripción</Text>}
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="10px">
          {aptitud.activo ? (
            <>
              <Button bg="orange.400" color="white" fontSize="15px" fontWeight="normal" border="none" p="6px 12px" rounded="4px" _hover={{ bg: "orange.500" }} onClick={() => onEdit(aptitud)}>
                Modificar
              </Button>
              <Button bg="red.600" color="white" fontSize="15px" fontWeight="normal" border="none" p="6px 12px" rounded="4px" _hover={{ bg: "red.700" }} onClick={() => onDelete(aptitud)}>
                Eliminar
              </Button>
            </>
          ) : (
            <Button bg="green.500" color="white" fontSize="15px" fontWeight="normal" border="none" p="6px 12px" rounded="4px" _hover={{ bg: "green.600" }} onClick={() => onReactivar(aptitud)}>
              Reactivar
            </Button>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}