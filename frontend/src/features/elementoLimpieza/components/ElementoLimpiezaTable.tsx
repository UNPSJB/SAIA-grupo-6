import { Table } from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";
import { ElementoLimpiezaItem } from "./ElementoLimpiezaItem";
import type { ColumnaOrdenElemento } from "../services/elementoLimpiezaService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface ElementoLimpiezaTableProps {
  elementos: ElementoLimpieza[];
  orden: OrdenTabla<ColumnaOrdenElemento, string>;
  onEdit: (elemento: ElementoLimpieza) => void;
  onDelete: (elemento: ElementoLimpieza) => void;
  onReactivar: (elemento: ElementoLimpieza) => void;
}

export function ElementoLimpiezaTable({
  elementos,
  orden,
  onEdit,
  onDelete,
  onReactivar,
}: ElementoLimpiezaTableProps) {
  if (elementos.length === 0) {
    return <EstadoVacio>No hay elementos de limpieza para mostrar.</EstadoVacio>;
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="nombre" orden={orden}>
              Nombre
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="ultimo_recambio"
              orden={orden}
              ancho="media"
            >
              Último Recambio
            </EncabezadoOrdenable>
            <EncabezadoOrdenable
              columna="frecuencia"
              orden={orden}
              ancho="media"
            >
              Frecuencia (Días)
            </EncabezadoOrdenable>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
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