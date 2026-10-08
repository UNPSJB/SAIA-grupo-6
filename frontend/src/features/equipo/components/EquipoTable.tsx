import { Table, Text } from "@chakra-ui/react";
import { EquipoItem } from "./EquipoItem";
import type { Equipo } from "../types/equipo";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface EquipoTableProps {
  equipos: Equipo[];
  onEdit: (equipo: Equipo) => void;
  onDelete: (equipo: Equipo) => void;
  onReactivar: (equipo: Equipo) => void;
  onCalibrar: (equipo: Equipo) => void;
  onVerHistorial: (equipo: Equipo) => void;
}

export function EquipoTable({
  equipos,
  onEdit,
  onDelete,
  onReactivar,
  onCalibrar,
  onVerHistorial,
}: EquipoTableProps) {
  if (equipos.length === 0) {
    return (
      <Tarjeta p={8} textAlign="center">
        <Text color="gray.500">No hay equipos para mostrar.</Text>
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
            <EncabezadoOscuro>Ubicación</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {equipos.map((equipo) => (
            <EquipoItem
              key={equipo.id}
              equipo={equipo}
              onEdit={onEdit}
              onDelete={onDelete}
              onReactivar={onReactivar}
              onCalibrar={onCalibrar}
              onVerHistorial={onVerHistorial}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
