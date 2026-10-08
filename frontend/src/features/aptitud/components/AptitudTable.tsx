import { Text, Table } from "@chakra-ui/react";
import { AptitudItem } from "./AptitudItem";
import type { Aptitud } from "../types/aptitud";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface AptitudTableProps {
  aptitudes: Aptitud[];
  onEdit: (aptitud: Aptitud) => void;
  onDelete: (aptitud: Aptitud) => void;
  onReactivar: (aptitud: Aptitud) => void;
}

export function AptitudTable({ aptitudes, onEdit, onDelete, onReactivar }: AptitudTableProps) {
  if (aptitudes.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay aptitudes registradas.</Text>
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
          {aptitudes.map((aptitud) => (
            <AptitudItem key={aptitud.id} aptitud={aptitud} onEdit={onEdit} onDelete={onDelete} onReactivar={onReactivar} />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}