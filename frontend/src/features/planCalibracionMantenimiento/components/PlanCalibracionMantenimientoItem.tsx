import { formatoFecha } from "../../../common/utils/fechas";
import { HStack, Table } from "@chakra-ui/react";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";
import {
  BotonAccion,
  Celda,
  EtiquetaEstado,
  DatoPrincipal,
  PildoraNeutra,
} from "../../../components/ui/patrones";

interface PlanCalibracionMantenimientoItemProps {
  plan: PlanCalibracionMantenimiento;
  nombreEquipo: string;
  onEdit: (plan: PlanCalibracionMantenimiento) => void;
  onDelete: (plan: PlanCalibracionMantenimiento) => void;
}

function obtenerEstado(diasRestantes: number) {
  if (diasRestantes <= 0) {
    return { etiqueta: "Vencido", tono: "peligro" as const };
  }
  if (diasRestantes <= 3) {
    return { etiqueta: "Próximo a vencer", tono: "alerta" as const };
  }
  return { etiqueta: "Vigente", tono: "ok" as const };
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
      <Celda>
        <DatoPrincipal titulo={nombreEquipo} />
      </Celda>
      <Celda>
        <PildoraNeutra>{plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"}</PildoraNeutra>
      </Celda>
      <Celda whiteSpace="nowrap">{formatoFecha(plan.fecha_ultima_intervencion)}</Celda>
      <Celda>
        Cada {plan.periodicidad_dias}{" "}
        {plan.periodicidad_dias === 1 ? "día" : "días"}
      </Celda>
      <Celda whiteSpace="nowrap">{formatoFecha(plan.proxima_fecha_vencimiento)}</Celda>
      <Celda center fontVariantNumeric="tabular-nums" fontWeight="semibold">
        {plan.dias_restantes}
      </Celda>
      <Celda center>
        <EtiquetaEstado tono={estado.tono}>{estado.etiqueta}</EtiquetaEstado>
      </Celda>
      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(plan)} />
          <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(plan)} />
        </HStack>
      </Celda>
    </Table.Row>
  );
}