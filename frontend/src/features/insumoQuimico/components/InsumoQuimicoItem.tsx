import { HStack, Table } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimico,
} from "../types/insumoQuimico";
import { BotonTabla, Celda } from "../../../components/ui/patrones";

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
      borderColor="gray.100"
      opacity={insumo.activo ? 1 : 0.65}
    >
      <Celda p="3" color="brand.500" fontWeight="bold" fontSize="md">
        #{insumo.id}
      </Celda>

      <Celda p="3" fontSize="md">
        {insumo.nombre}
      </Celda>

      <Celda p="3" fontSize="md">
        {tipoLabel}
      </Celda>

      <Celda p="3" fontSize="md">
        {unidadLabel}
      </Celda>

      <Celda p="3" center>
        <HStack justify="center" gap="2">
          {insumo.activo ? (
            <>
              <BotonTabla accion="editar" onClick={() => onEdit(insumo)}>
                Modificar
              </BotonTabla>

              <BotonTabla accion="eliminar" onClick={() => onDelete(insumo)}>
                Eliminar
              </BotonTabla>
            </>
          ) : (
            <BotonTabla accion="reactivar" onClick={() => onReactivar(insumo)}>
              Reactivar
            </BotonTabla>
          )}
        </HStack>
      </Celda>
    </Table.Row>
  );
}
