import { Table, Text } from "@chakra-ui/react";
import { PersonalItem } from "./PersonalItem";
import type { Persona } from "../types/personal";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PersonalTableProps {
  personales: Persona[];
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onReactivar: (persona: Persona) => void;
}

export function PersonalTable({ personales, onEdit, onDelete, onReactivar }: PersonalTableProps) {
  if (personales.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay personal para mostrar.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Nombre</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">DNI</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Permisos</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="angosta">Detalle</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="accionesAnchas">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {personales.map((persona) => (
            <PersonalItem key={persona.id} persona={persona} onEdit={onEdit} onDelete={onDelete} onReactivar={onReactivar} />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}