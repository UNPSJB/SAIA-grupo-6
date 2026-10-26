import { HStack, Table, Text } from "@chakra-ui/react";
import type { Sector } from "../types/sector";
import { BotonTabla, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface SectorItemProps {
  sector: Sector;
  onEdit: (sector: Sector) => void;
  onDelete: (sector: Sector) => void;
  onReactivar: (sector: Sector) => void;
}

export function SectorItem({ sector, onEdit, onDelete, onReactivar }: SectorItemProps) {
  return (
    <Table.Row borderBottomWidth="1px" borderColor="border.subtle" opacity={sector.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={sector.nombre} />
      </Celda>
      <Celda p="3">
        {sector.descripcion ? (
          <TextoTruncado texto={sector.descripcion} max={60} />
        ) : (
          <Text as="span" color="fg.subtle" fontStyle="italic">
            Sin descripción
          </Text>
        )}
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {sector.activo ? (
            <>
              <BotonTabla accion="editar" onClick={() => onEdit(sector)}>
                Modificar
              </BotonTabla>
              <BotonTabla accion="eliminar" onClick={() => onDelete(sector)}>
                Eliminar
              </BotonTabla>
            </>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(sector)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}