import { HStack, Table } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface EquipoItemProps {
  equipo: Equipo;
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onIntervenir: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void;
}

export function EquipoItem({
  equipo,
  onEdit,
  onDelete,
  onReactivar,
  onIntervenir,
  onVerHistorial,
}: EquipoItemProps) {
  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={equipo.activo ? 1 : 0.65}
    >
      <Celda p="3">
        <TextoTruncado texto={equipo.nombre} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={equipo.tipo} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={equipo.ubicacion} />
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {equipo.activo && (
            <>
              <BotonAccion
                accion="historial"
                label="Ver historial de calibraciones"
                onClick={() => onVerHistorial(equipo)}
              />
              <BotonAccion
                accion="intervenir"
                label="Registrar intervención"
                onClick={() => onIntervenir(equipo)}
              />
              <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(equipo)} />
            </>
          )}
          {equipo.activo ? (
            <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(equipo)} />
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(equipo)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
