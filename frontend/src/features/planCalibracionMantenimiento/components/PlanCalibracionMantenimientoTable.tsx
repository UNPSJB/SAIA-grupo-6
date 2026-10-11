import { Table } from "@chakra-ui/react";
import { PlanCalibracionMantenimientoItem } from "./PlanCalibracionMantenimientoItem";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PlanCalibracionMantenimientoTableProps {
  planes: PlanCalibracionMantenimiento[];
  nombresEquipos: Map<number, string>;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
  onDelete: (plan: PlanCalibracionMantenimiento) => void;
}

export function PlanCalibracionMantenimientoTable({
  planes,
  nombresEquipos,
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
            <EncabezadoOscuro>Equipo</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Tipo</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Última intervención</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Periodicidad</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Próximo vencimiento</EncabezadoOscuro>
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