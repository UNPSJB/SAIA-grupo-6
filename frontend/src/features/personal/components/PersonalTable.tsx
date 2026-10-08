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
      <Tarjeta p={8} textAlign="center">
        <Text color="gray.500">No hay personal para mostrar.</Text>
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
            <EncabezadoOscuro>DNI</EncabezadoOscuro>
            <EncabezadoOscuro>Permisos</EncabezadoOscuro>
            <EncabezadoOscuro center>Detalle</EncabezadoOscuro>
            <EncabezadoOscuro center>Acciones</EncabezadoOscuro>
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