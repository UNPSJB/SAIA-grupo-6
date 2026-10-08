import { HStack, Table, Text } from "@chakra-ui/react";
import type { Aptitud } from "../types/aptitud";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

interface AptitudItemProps {
  aptitud: Aptitud;
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudItem({ aptitud, onEdit, onDelete, onReactivar }: AptitudItemProps) {
  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={aptitud.activo ? 1 : 0.65}>
      <Celda p="3" color="brand.fg" fontWeight="bold">
        #{aptitud.id}
      </Celda>
      <Celda p="3">{aptitud.nombre}</Celda>
      <Celda p="3">
        {aptitud.descripcion || (
          <Text as="span" color="fg.subtle" fontStyle="italic">
            Sin descripción
          </Text>
        )}
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2">
          {aptitud.activo ? (
            <>
              <BotonTabla accion="editar" onClick={() => onEdit(aptitud)}>
                Modificar
              </BotonTabla>
              <BotonTabla accion="eliminar" onClick={() => onDelete(aptitud)}>
                Eliminar
              </BotonTabla>
            </>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(aptitud)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
