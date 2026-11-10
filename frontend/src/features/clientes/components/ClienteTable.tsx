import { Table, Text } from "@chakra-ui/react";
import type { Cliente } from "../types/cliente";
import type { OrdenCliente } from "../services/clienteService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { ClienteItem } from "./ClienteItem";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface ClienteTableProps {
  clientes: Cliente[];
  orden?: {
    columna: string | null;
    direccion: "asc" | "desc";
    orden: string;
    esPorDefecto: boolean;
    ordenar: (columna: string) => void;
    reiniciar: () => void;
  };
  onEdit: (cliente: Cliente) => void;
  onDelete: (cliente: Cliente) => void;
  onReactivar: (cliente: Cliente) => void;
  onVer?: (cliente: Cliente) => void;
}

export function ClienteTable({
  clientes,
  orden,
  onEdit,
  onDelete,
  onReactivar,
  onVer,
}: ClienteTableProps) {
  if (clientes.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay clientes registrados.</Text>
      </Tarjeta>
    );
  }

  const tieneOrden = orden !== undefined;

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="800px">
        <Table.Header>
          <FilaEncabezado>
            {tieneOrden && orden ? (
              <EncabezadoOrdenable columna="nombre" orden={orden as any} ancho="amplia">
                Nombre
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="amplia">Nombre</EncabezadoOscuro>
            )}
            {tieneOrden && orden ? (
              <EncabezadoOrdenable columna="documento" orden={orden as any} ancho="media">
                Documento
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="media">Documento</EncabezadoOscuro>
            )}
            <EncabezadoOscuro ancho="media">Teléfono</EncabezadoOscuro>
            <EncabezadoOscuro>Domicilio</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {clientes.map((cliente) => (
            <ClienteItem
              key={cliente.id}
              cliente={cliente}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
              onVer={onVer}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
