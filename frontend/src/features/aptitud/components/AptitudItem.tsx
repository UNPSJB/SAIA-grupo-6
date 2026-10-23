import { HStack, Table, Text } from "@chakra-ui/react";
import type { Aptitud } from "../types/aptitud";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface AptitudItemProps {
  aptitud: Aptitud;
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudItem({ aptitud, onEdit, onDelete, onReactivar }: AptitudItemProps) {
  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={aptitud.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={aptitud.nombre} />
      </Celda>
      <Celda p="3">
        {aptitud.descripcion ? (
          <TextoTruncado texto={aptitud.descripcion} max={60} />
        ) : (
          <Text as="span" color="fg.subtle" fontStyle="italic">
            Sin descripción
          </Text>
        )}
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {aptitud.activo ? (
            <>
              <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(aptitud)} />
              <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(aptitud)} />
            </>
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(aptitud)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
