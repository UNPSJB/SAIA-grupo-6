import { Table } from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import { ElementoLimpiezaItem } from "./ElementoLimpiezaItem";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface ElementoLimpiezaTableProps {
  elementos: ElementoLimpieza[];
  onEdit: (elemento: ElementoLimpieza) => void;
  onDelete: (elemento: ElementoLimpieza) => void;
  onReactivar: (elemento: ElementoLimpieza) => void;
}

export function ElementoLimpiezaTable({
  elementos,
  onEdit,
  onDelete,
  onReactivar,
}: ElementoLimpiezaTableProps) {
  if (elementos.length === 0) {
    return <EstadoVacio>No hay elementos de limpieza para mostrar.</EstadoVacio>;
  }

  return (
    <Tarjeta>
      <Table.Root variant="outline" w="100%">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>ID</EncabezadoOscuro>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Último Recambio</EncabezadoOscuro>
            <EncabezadoOscuro>Frecuencia (Días)</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {elementos.map((elemento) => (
            <ElementoLimpiezaItem
              key={elemento.id}
              elemento={elemento}
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