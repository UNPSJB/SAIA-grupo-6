import { Button, HStack, Table } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

interface EquipoItemProps {
  equipo: Equipo;
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onCalibrar: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void;
}

export function EquipoItem({
  equipo,
  onEdit,
  onDelete,
  onReactivar,
  onCalibrar,
  onVerHistorial,
}: EquipoItemProps) {
  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="gray.100"
      opacity={equipo.activo ? 1 : 0.65}
    >
      <Celda p="3" color="brand.500" fontWeight="bold" fontSize="md">
        #{equipo.id}
      </Celda>
      <Celda p="3" fontSize="md">
        {equipo.nombre}
      </Celda>
      <Celda p="3" fontSize="md">
        {equipo.tipo}
      </Celda>
      <Celda p="3" fontSize="md">
        {equipo.ubicacion}
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2">
          {equipo.activo && (
            <>
              {/* "Historial" y "Calibrar" no son acciones del CRUD estándar,
                  así que no entran en `BotonTabla`: se arman con las mismas
                  medidas que el patrón para que la fila quede homogénea. */}
              <Button
                type="button"
                colorPalette="brand"
                variant="solid"
                size="sm"
                fontWeight="normal"
                h="auto"
                px="3"
                py="1.5"
                rounded="md"
                onClick={() => onVerHistorial(equipo)}
              >
                Historial
              </Button>
              <Button
                type="button"
                colorPalette="gray"
                variant="solid"
                size="sm"
                fontWeight="normal"
                h="auto"
                px="3"
                py="1.5"
                rounded="md"
                onClick={() => onCalibrar(equipo)}
              >
                Calibrar
              </Button>
              <BotonTabla accion="editar" onClick={() => onEdit(equipo)}>
                Modificar
              </BotonTabla>
            </>
          )}
          {equipo.activo ? (
            <BotonTabla accion="eliminar" onClick={() => onDelete(equipo)}>
              Eliminar
            </BotonTabla>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(equipo)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
