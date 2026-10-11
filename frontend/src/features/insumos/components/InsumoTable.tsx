import { Table, Text } from "@chakra-ui/react";
import { InsumoItem } from "./InsumoItem";
import type { Insumo } from "../types/insumo";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface InsumoTableProps {
  insumos: Insumo[];
  onEdit: (insumo: Insumo) => void;
  onDelete: (insumo: Insumo) => void;
  onReactivar: (insumo: Insumo) => void;
}

export function InsumoTable({
  insumos,
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
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Unidad Medida</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
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