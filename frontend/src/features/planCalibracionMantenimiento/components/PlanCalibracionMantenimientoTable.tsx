import { Table, Text } from "@chakra-ui/react";
import { PlanCalibracionMantenimientoItem } from "./PlanCalibracionMantenimientoItem";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import {
  EncabezadoOscuro,
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
    return (
      <Tarjeta p={8} textAlign="center">
        <Text color="gray.500">No hay planes para mostrar.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" minW="1200px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>ID</EncabezadoOscuro>
            <EncabezadoOscuro>Equipo</EncabezadoOscuro>
            <EncabezadoOscuro>Tipo</EncabezadoOscuro>
            <EncabezadoOscuro>Última intervención</EncabezadoOscuro>
            <EncabezadoOscuro>Periodicidad</EncabezadoOscuro>
            <EncabezadoOscuro>Próximo vencimiento</EncabezadoOscuro>
            <EncabezadoOscuro center>Días restantes</EncabezadoOscuro>
            <EncabezadoOscuro center>Estado</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
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