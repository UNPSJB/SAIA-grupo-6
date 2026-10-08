import { Table } from "@chakra-ui/react";
import { PlanLimpiezaItem } from "./PlanLimpiezaItem";
import type { EquipoOption, PlanLimpieza } from "../types/planLimpieza";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PlanLimpiezaTableProps {
  planes: PlanLimpieza[];
  equipos: EquipoOption[];
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
  onReactivar: (plan: PlanLimpieza) => void;
}

export function PlanLimpiezaTable({
  planes,
  equipos,
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
    <Tarjeta>
      <Table.Root variant="outline" w="100%">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>ID</EncabezadoOscuro>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Tareas (frecuencia)</EncabezadoOscuro>
            <EncabezadoOscuro>Equipo</EncabezadoOscuro>
            <EncabezadoOscuro center>Estado</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
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