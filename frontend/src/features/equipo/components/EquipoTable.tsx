import { Table, Text } from "@chakra-ui/react";
import { EquipoItem } from "./EquipoItem";
import type { Equipo } from "../types/equipo";
import type { ColumnaOrdenEquipo } from "../services/equipoService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface EquipoTableProps {
  equipos: Equipo[];
  orden: OrdenTabla<ColumnaOrdenEquipo, string>;
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onIntervenir: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void;
}

export function EquipoTable({
  equipos,
  orden,
  onEdit,
  onDelete,
  onReactivar,
  onIntervenir,
  onVerHistorial,
}: EquipoTableProps) {
  if (equipos.length === 0) {
    return (
      <Tarjeta p={8} textAlign="center">
        <Text color="fg.muted">No hay equipos para mostrar.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="nombre" orden={orden}>
              Nombre
            </EncabezadoOrdenable>
            <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
              Tipo
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="sector"
              orden={orden}
              ancho="amplia"
            >
              Sector
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="accionesAnchas">
              Acciones
            </EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {equipos.map((equipo) => (
            <EquipoItem
              key={equipo.id}
              equipo={equipo}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
              onIntervenir={onIntervenir}
              onVerHistorial={onVerHistorial}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
