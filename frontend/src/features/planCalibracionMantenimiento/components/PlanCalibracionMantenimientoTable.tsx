import { Table } from "@chakra-ui/react";
import { PlanCalibracionMantenimientoItem } from "./PlanCalibracionMantenimientoItem";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import type { ColumnaOrdenPlanCalibracion } from "../services/planCalibracionMantenimientoService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PlanCalibracionMantenimientoTableProps {
  planes: PlanCalibracionMantenimiento[];
  nombresEquipos: Map<number, string>;
  orden: OrdenTabla<ColumnaOrdenPlanCalibracion, string>;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
  onDelete: (plan: PlanCalibracionMantenimiento) => void;
}

export function PlanCalibracionMantenimientoTable({
  planes,
  nombresEquipos,
  orden,
  onEdit,
  onDelete,
}: PlanCalibracionMantenimientoTableProps) {
  if (planes.length === 0) {
    return <EstadoVacio>No hay planes para mostrar.</EstadoVacio>;
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" minW="1200px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="equipo" orden={orden}>
              Equipo
            </EncabezadoOrdenable>
            <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
              Tipo
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="intervencion"
              orden={orden}
              ancho="media"
            >
              Última intervención
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="periodicidad"
              orden={orden}
              ancho="media"
            >
              Periodicidad
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="vencimiento"
              orden={orden}
              ancho="media"
            >
              Próximo vencimiento
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="media">Días restantes</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="angosta">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {planes.map((plan) => (
            <PlanCalibracionMantenimientoItem
              key={plan.id}
              plan={plan}
              nombreEquipo={
                nombresEquipos.get(plan.equipo_id) || `Equipo #${plan.equipo_id}`
              }
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
