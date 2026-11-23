import { useState, type ReactNode } from "react";
import { HStack, Stack, Table, Text } from "@chakra-ui/react";
import { EstadoEntidad } from "../../../components/ui/ResumenEntidadDialog";
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
import { ResumenProductoDialog } from "./ResumenProductoDialog";

interface ProductoTableProps {
  productos: Producto[];
  onEdit: (producto: Producto) => void;
  onDelete: (producto: Producto) => void;
  onReactivar: (producto: Producto) => void;
  onNutricion: (producto: Producto) => void;
  onRotulado: (producto: Producto) => void;
  /** Pie de la tarjeta (resumen y paginación, `PieTabla`). */
  pie?: ReactNode;
}

export function ProductoTable({
  productos,
  onEdit,
  onDelete,
  onReactivar,
  onNutricion,
  onRotulado,
  pie,
}: ProductoTableProps) {
  const [resumenId, setResumenId] = useState<number | null>(null);
  const resumen = productos.find(producto => producto.id === resumenId);

  if (productos.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay productos registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <>
      <TarjetaTabla pie={pie}>
        {/* Anchos proporcionales: nombre y descripción se reparten el espacio y
            la columna de acciones reserva espacio para los botones. */}
        <Table.Root variant="outline" w="100%" minW="760px">
          <Table.Header>
            <FilaEncabezado>
              <EncabezadoOscuro width="32%">Nombre</EncabezadoOscuro>
              <EncabezadoOscuro>Descripción</EncabezadoOscuro>
              <EncabezadoOscuro center width="11%">Unidad</EncabezadoOscuro>
              <EncabezadoOscuro center minW="220px">Acciones</EncabezadoOscuro>
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
                  <Stack gap="1" align="start">
                    <DatoPrincipal titulo={producto.nombre} />
                    <EstadoEntidad activo={producto.activo} />
                  </Stack>
                </Celda>
                <Celda>
                  <TextoTruncado texto={producto.descripcion ?? "-"} color="tabla.textoSecundario" />
                </Celda>
                <Celda center>
                  <PildoraNeutra>{producto.unidad_medida.simbolo}</PildoraNeutra>
                </Celda>
                <Celda center>
                  <HStack justify="center" gap="2" flexWrap="wrap" rowGap="2">
                    <BotonAccion accion="ver" label={`Ver resumen de ${producto.nombre}`} tooltip="Ver resumen"
                      onClick={() => setResumenId(producto.id)} />
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
      </TarjetaTabla>
      {resumen && (
        <ResumenProductoDialog key={resumen.id} producto={resumen} onCerrar={() => setResumenId(null)}
          onNutricion={() => { setResumenId(null); onNutricion(resumen); }}
          onRotulado={() => { setResumenId(null); onRotulado(resumen); }}
        />
      )}
    </>
  );
}
