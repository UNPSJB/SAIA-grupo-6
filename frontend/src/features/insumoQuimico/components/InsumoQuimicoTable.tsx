import { Table, Text } from "@chakra-ui/react";
import { InsumoQuimicoItem } from "./InsumoQuimicoItem";
import type { InsumoQuimico } from "../types/insumoQuimico";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface InsumoQuimicoTableProps {
  insumos: InsumoQuimico[];
  onEdit: (insumo: InsumoQuimico) => void;
  onDelete: (insumo: InsumoQuimico) => void;
  onReactivar: (insumo: InsumoQuimico) => void;
}

export function InsumoQuimicoTable({
  insumos,
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
    <Tarjeta>
      <Table.Root variant="outline" w="100%">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>ID</EncabezadoOscuro>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Tipo</EncabezadoOscuro>
            <EncabezadoOscuro>Unidad Medida</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
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
