import { Table, Text } from "@chakra-ui/react";
import { PersonalItem } from "./PersonalItem";
import type { Persona } from "../types/personal";
import type { ColumnaOrdenPersonal } from "../services/personalService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface PersonalTableProps {
  personales: Persona[];
  orden: OrdenTabla<ColumnaOrdenPersonal, string>;
  onEdit: (persona: Persona) => void;
  onDelete: (persona: Persona) => void;
  onReactivar: (persona: Persona) => void;
}

export function PersonalTable({
  personales,
  orden,
  onEdit,
  onDelete,
  onReactivar,
}: PersonalTableProps) {
  if (personales.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">No hay personal para mostrar.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="720px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOrdenable columna="nombre" orden={orden}>
              Nombre
            </EncabezadoOrdenable>
            <EncabezadoOrdenable columna="dni" orden={orden} ancho="media">
              DNI
            </EncabezadoOrdenable>
            <EncabezadoOscuro ancho="media">Permisos</EncabezadoOscuro>
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