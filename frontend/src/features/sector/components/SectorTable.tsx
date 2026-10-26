import { Text, Table } from "@chakra-ui/react";
import { SectorItem } from "./SectorItem";
import type { Sector } from "../types/sector";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface SectorTableProps {
  sectores: Sector[];
  onEdit: (sector: Sector) => void;
  onDelete: (sector: Sector) => void;
  onReactivar: (sector: Sector) => void;
}

export function SectorTable({ sectores, onEdit, onDelete, onReactivar }: SectorTableProps) {
  if (sectores.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay sectores registrados.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro>Descripción</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {sectores.map((sector) => (
            <SectorItem key={sector.id} sector={sector} onEdit={onEdit} onDelete={onDelete} onReactivar={onReactivar} />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}