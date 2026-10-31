import { Table, Text } from "@chakra-ui/react";
import type { Proveedor } from "../types/proveedor";
import { ProveedorItem } from "./ProveedorItem";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface ProveedorTableProps {
  proveedores: Proveedor[];
  onEdit: (proveedor: Proveedor) => void;
  onDelete: (proveedor: Proveedor) => void;
  onReactivar: (proveedor: Proveedor) => void;
}

export function ProveedorTable({ proveedores, onEdit, onDelete, onReactivar }: ProveedorTableProps) {
  if (proveedores.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay proveedores registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="680px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Matrícula</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {proveedores.map((proveedor) => (
            <ProveedorItem
              key={proveedor.id}
              proveedor={proveedor}
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
