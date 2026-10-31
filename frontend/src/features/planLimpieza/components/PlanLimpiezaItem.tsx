import { HStack, Table } from "@chakra-ui/react";
import type { PlanLimpieza } from "../types/planLimpieza";
import { BotonAccion, Celda, TextoTruncado } from "../../../components/ui/patrones";

interface PlanLimpiezaItemProps {
  plan: PlanLimpieza;
  nombreEquipo: string;
  nombreSector: string;
  onEdit: (plan: PlanLimpieza) => void;
  onDelete: (plan: PlanLimpieza) => void;
  onReactivar: (plan: PlanLimpieza) => void;
}

export function PlanLimpiezaItem({
  plan,
  nombreEquipo,
  nombreSector,
  onEdit,
  onDelete,
  onReactivar,
}: PlanLimpiezaItemProps) {
  return (
    <Table.Row opacity={plan.activo ? 1 : 0.65}>
      <Celda p="3">
        <TextoTruncado texto={plan.nombre} />
      </Celda>
      <Celda p="3">
        {/*
         * La lista de tareas concatenadas puede pasar los 200 caracteres: sin
         * tope, esta celda era la que más engordaba la fila.
         */}
        <TextoTruncado
          max={60}
          texto={plan.tareas
            .map(
              (tarea) =>
                `${tarea.nombre} (cada ${tarea.frecuencia} ${tarea.frecuencia === 1 ? "día" : "días"})`,
            )
            .join(", ")}
        />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={nombreSector} />
      </Celda>
      <Celda p="3">
        <TextoTruncado texto={nombreEquipo} />
      </Celda>
      <Celda p="3" center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {plan.activo ? (
            <>
              <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(plan)} />
              <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(plan)} />
            </>
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(plan)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}