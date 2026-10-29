import { Table } from "@chakra-ui/react";
import { PlanLimpiezaItem } from "./PlanLimpiezaItem";
import type { EquipoOption, PlanLimpieza } from "../types/planLimpieza";
import type { ColumnaOrdenPlanLimpieza } from "../services/planLimpiezaService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PlanLimpiezaTableProps {
  planes: PlanLimpieza[];
  equipos: EquipoOption[];
  orden: OrdenTabla<ColumnaOrdenPlanLimpieza, string>;
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
  onReactivar: (plan: PlanLimpieza) => void;
}

export function PlanLimpiezaTable({
  planes,
  equipos,
  orden,
  onEdit,
  onDelete,
  onReactivar,
}: PlanLimpiezaTableProps) {
  if (planes.length === 0) {
    return <EstadoVacio>No hay planes de limpieza cargados.</EstadoVacio>;
  }

  const nombreEquipo = (id: number) =>
    equipos.find((e) => e.id === id)?.nombre || `#${id}`;

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="nombre" orden={orden}>
              Nombre
            </EncabezadoOrdenable>
            <EncabezadoOscuro ancho="amplia">Tareas (frecuencia)</EncabezadoOscuro>
            <EncabezadoOrdenable columna="equipo" orden={orden} ancho="media">
              Equipo
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {planes.map((plan) => (
            <PlanLimpiezaItem
              key={plan.id}
              plan={plan}
              nombreEquipo={nombreEquipo(plan.equipo_id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
