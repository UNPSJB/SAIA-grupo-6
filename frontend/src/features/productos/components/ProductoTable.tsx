import type { ReactNode } from "react";
import { HStack, Table, Text } from "@chakra-ui/react";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  FilaEncabezado,
  PildoraNeutra,
  Tarjeta,
  TarjetaTabla,
  TextoTruncado,
} from "../../../components/ui/patrones";
import type { Producto } from "../types/producto";

interface ProductoTableProps {
  productos: Producto[];
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  onReactivar: (producto: Producto) => void;
  onNutricion: (producto: Producto) => void;
  /** Pie de la tarjeta (resumen y paginación, `PieTabla`). */
  pie?: ReactNode;
}

export function ProductoTable({ productos, onEdit, onDelete, onReactivar, onNutricion, pie }: ProductoTableProps) {
  if (productos.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay productos registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <TarjetaTabla pie={pie}>
      {/* Anchos proporcionales: nombre y descripción se reparten el espacio y
          la columna de acciones mide lo justo para sus tres botones. */}
      <Table.Root variant="outline" w="100%" minW="680px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro width="32%">Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Descripción</EncabezadoOscuro>
            <EncabezadoOscuro center width="11%">Unidad</EncabezadoOscuro>
            <EncabezadoOscuro center width="17%">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {productos.map((producto) => (
            <Table.Row
              key={producto.id}
              borderBottomWidth="1px"
              borderColor="border.subtle"
              opacity={producto.activo ? 1 : 0.65}
            >
              <Celda>
                <DatoPrincipal titulo={producto.nombre} />
              </Celda>
              <Celda>
                <TextoTruncado texto={producto.descripcion ?? "-"} color="#64748B" />
              </Celda>
              <Celda center>
                <PildoraNeutra>{producto.unidad_medida.simbolo}</PildoraNeutra>
              </Celda>
              <Celda center>
                <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
                  {producto.activo ? (
                    <>
                      <BotonAccion accion="editar" label="Modificar producto" onClick={() => onEdit(producto)} />
                      <BotonAccion accion="nutricion" label="Información nutricional" onClick={() => onNutricion(producto)} />
                      <BotonAccion accion="eliminar" label="Eliminar producto" onClick={() => onDelete(producto)} />
                    </>
                  ) : (
                    <BotonAccion accion="reactivar" label="Reactivar producto" onClick={() => onReactivar(producto)} />
                  )}
                </HStack>
              </Celda>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </TarjetaTabla>
  );
}
