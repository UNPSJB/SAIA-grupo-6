import { Table, Text } from "@chakra-ui/react";
import { UnidadMedidaItem } from "./UnidadMedidaItem";
import type { UnidadMedida } from "../types/unidadMedida";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface UnidadMedidaTableProps {
  unidades: UnidadMedida[];
  onEdit: (unidad: UnidadMedida) => void;
  onDelete: (unidad: UnidadMedida) => void;
  onReactivar: (unidad: UnidadMedida) => void;
}

export function UnidadMedidaTable({
  unidades,
  onEdit,
  onDelete,
  onReactivar,
}: UnidadMedidaTableProps) {
  if (unidades.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay unidades de medida registradas.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro ancho="angosta">Símbolo</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>

        <Table.Body>
          {unidades.map((unidad) => (
            <UnidadMedidaItem
              key={unidad.id}
              unidad={unidad}
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