import { HStack, Table } from "@chakra-ui/react";
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
      borderColor="border.subtle"
      opacity={equipo.activo ? 1 : 0.65}
    >
      <Celda p="3" color="brand.500" fontWeight="bold">
        #{equipo.id}
      </Celda>
      <Celda p="3">{equipo.nombre}</Celda>
      <Celda p="3">{equipo.tipo}</Celda>
      <Celda p="3">{equipo.ubicacion}</Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2">
          {equipo.activo && (
            <>
              <BotonTabla accion="historial" onClick={() => onVerHistorial(equipo)}>
                Historial
              </BotonTabla>
              <BotonTabla accion="calibrar" onClick={() => onCalibrar(equipo)}>
                Calibrar
              </BotonTabla>
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
