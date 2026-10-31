import { Table, Text } from "@chakra-ui/react";
import { InsumoItem } from "./InsumoItem";
import type { Insumo } from "../types/insumo";
import type { ColumnaOrdenInsumo } from "../services/insumoService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface InsumoTableProps {
  insumos: Insumo[];
  orden: OrdenTabla<ColumnaOrdenInsumo, string>;
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
}

export function InsumoTable({
  insumos,
  orden,
  onEdit,
  onDelete,
  onReactivar,
}: InsumoTableProps) {
  if (insumos.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay insumos para mostrar.</Text>
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
            <EncabezadoOrdenable columna="unidad" orden={orden} ancho="media">
              Unidad Medida
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="accionesAnchas">
              Acciones
            </EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {insumos.map((insumo) => (
            <InsumoItem
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
