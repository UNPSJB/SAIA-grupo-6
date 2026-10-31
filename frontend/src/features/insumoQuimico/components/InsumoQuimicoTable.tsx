import { Table, Text } from "@chakra-ui/react";
import { InsumoQuimicoItem } from "./InsumoQuimicoItem";
import type { InsumoQuimico } from "../types/insumoQuimico";
import type { ColumnaOrdenInsumoQuimico } from "../services/insumoQuimicoService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface InsumoQuimicoTableProps {
  insumos: InsumoQuimico[];
  orden: OrdenTabla<ColumnaOrdenInsumoQuimico, string>;
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

export function InsumoQuimicoTable({
  insumos,
  orden,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoQuimicoTableProps) {
  if (insumos.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay insumos químicos registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="nombre" orden={orden}>
              Nombre
            </EncabezadoOrdenable>
            <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
              Tipo
            </EncabezadoOrdenable>
            <EncabezadoOrdenable columna="unidad" orden={orden} ancho="media">
              Unidad Medida
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>

        <Table.Body>
          {insumos.map((insumo) => (
            <InsumoQuimicoItem
              key={insumo.id}
              insumo={insumo}
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
