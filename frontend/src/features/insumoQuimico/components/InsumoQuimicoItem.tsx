import { HStack, Table } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimico,
} from "../types/insumoQuimico";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  PildoraNeutra,
} from "../../../components/ui/patrones";

interface InsumoQuimicoItemProps {
  insumo: InsumoQuimico;
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

export function InsumoQuimicoItem({
  insumo,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoQuimicoItemProps) {
  const tipoLabel =
    TIPOS_QUIMICOS.find((t) => t.value === insumo.tipo)?.label ?? insumo.tipo;

  const unidadLabel = insumo.unidad_medida
    ? `${insumo.unidad_medida.nombre} (${insumo.unidad_medida.simbolo})`
    : `#${insumo.unidad_medida_id}`;

  return (
    <Table.Row
      borderBottomWidth="1px"
      borderColor="border.subtle"
      opacity={insumo.activo ? 1 : 0.65}
    >

      <Celda>
        <DatoPrincipal titulo={insumo.nombre} />
      </Celda>

      <Celda>{tipoLabel}</Celda>

      <Celda>
        <PildoraNeutra>{unidadLabel}</PildoraNeutra>
      </Celda>

      <Celda center>
        <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
          {insumo.activo ? (
            <>
              <BotonAccion accion="editar" label="Modificar" onClick={() => onEdit(insumo)} />

              <BotonAccion accion="eliminar" label="Eliminar" onClick={() => onDelete(insumo)} />
            </>
          ) : (
            <BotonAccion accion="reactivar" label="Reactivar" onClick={() => onReactivar(insumo)} />
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
