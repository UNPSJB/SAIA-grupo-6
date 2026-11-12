import { HStack, Table, Text } from "@chakra-ui/react";
import {
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
  TextoTruncado,
} from "../../../components/ui/patrones";
import type { Producto } from "../types/producto";

interface ProductoTableProps {
  productos: Producto[];
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  onReactivar: (producto: Producto) => void;
  onNutricion: (producto: Producto) => void;
  onRotulado: (producto: Producto) => void;
}

export function ProductoTable({
  productos,
  onEdit,
  onDelete,
  onReactivar,
  onNutricion,
  onRotulado,
}: ProductoTableProps) {
  if (productos.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay productos registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="680px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Descripción</EncabezadoOscuro>
            <EncabezadoOscuro ancho="angosta">Unidad</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
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
              <Celda p="3">
                <TextoTruncado texto={producto.nombre} />
              </Celda>
              <Celda p="3">
                <TextoTruncado texto={producto.descripcion ?? "-"} />
              </Celda>
              <Celda p="3">{producto.unidad_medida.simbolo}</Celda>
              <Celda p="3" center>
                <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
                  {producto.activo ? (
                    <>
                      <BotonAccion accion="editar" label="Modificar producto" onClick={() => onEdit(producto)} />
                      <BotonAccion accion="nutricion" label="Información nutricional" onClick={() => onNutricion(producto)} />
                      <BotonAccion accion="rotulado" label="Rotulado frontal" onClick={() => onRotulado(producto)} />
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
    </Tarjeta>
  );
}
