import { HStack } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { Equipo } from "../types/equipo";
import {
  BotonAccion,
  Celda,
  FilaClickeable,
  TextoTruncado,
  DatoPrincipal,
  PildoraNeutra,
} from "../../../components/ui/patrones";

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
  const navigate = useNavigate();
  return (
    <FilaClickeable onAbrir={() => navigate(`/equipos/detalle/${equipo.id}`)}
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={equipo.activo ? 1 : 0.65}
    >
      <Celda>
        <DatoPrincipal titulo={equipo.nombre} />
      </Celda>
      <Celda>
        <PildoraNeutra>{equipo.tipo}</PildoraNeutra>
      </Celda>
      <Celda>
        <TextoTruncado texto={equipo.sector.nombre} />
      </Celda>
      <Celda center>
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
    </FilaClickeable>
  );
}
