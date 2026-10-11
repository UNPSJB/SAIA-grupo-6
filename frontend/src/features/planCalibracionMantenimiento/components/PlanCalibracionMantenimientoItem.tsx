import { formatoFecha } from "../../../common/utils/fechas";
import { Badge, HStack, Table } from "@chakra-ui/react";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

interface PlanCalibracionMantenimientoItemProps {
  plan: PlanCalibracionMantenimiento;
  nombreEquipo: string;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
  onDelete: (plan: PlanCalibracionMantenimiento) => void;
}

function obtenerEstado(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return { etiqueta: "Vencido", color: "red" };
  }
  if (diasRestantes <= 3) {
    return { etiqueta: "Próximo a vencer", color: "orange" };
  }
  return { etiqueta: "Vigente", color: "green" };
}

export function PlanCalibracionMantenimientoItem({
  plan,
  nombreEquipo,
  onEdit,
  onDelete,
}: PlanCalibracionMantenimientoItemProps) {
  const estado = obtenerEstado(plan.dias_restantes);

  return (
    <Table.Row>
      <Celda p="3">{nombreEquipo}</Celda>
      <Celda p="3">
        {plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"}
      </Celda>
      <Celda p="3">{formatoFecha(plan.fecha_ultima_intervencion)}</Celda>
      <Celda p="3">
        Cada {plan.periodicidad_dias}{" "}
        {plan.periodicidad_dias === 1 ? "día" : "días"}
      </Celda>
      <Celda p="3">{formatoFecha(plan.proxima_fecha_vencimiento)}</Celda>
      <Celda p="3" center>
        {plan.dias_restantes}
      </Celda>
      <Celda p="3" center>
        <Badge colorPalette={estado.color} rounded="md" px="2" py="1">
          {estado.etiqueta}
        </Badge>
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          <BotonTabla accion="editar" onClick={() => onEdit(plan)}>
            Modificar
          </BotonTabla>
          <BotonTabla accion="eliminar" onClick={() => onDelete(plan)}>
            Eliminar
          </BotonTabla>
        </HStack>
      </Celda>
    </Table.Row>
  );
}