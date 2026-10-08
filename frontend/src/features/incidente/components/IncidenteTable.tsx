import { Table, Text } from "@chakra-ui/react";
import { IncidenteItem } from "./IncidenteItem";
import type { Incidente } from "../types/incidente";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface IncidenteTableProps {
  incidentes: Incidente[];
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
  mensajeVacio?: string;
}

export function IncidenteTable({
  incidentes,
  onCerrar,
  onReabrir,
  onVer,
  showActions = true,
  mensajeVacio = "Todavía no se registraron incidentes.",
}: IncidenteTableProps) {
  if (incidentes.length === 0) {
    return (
      <Tarjeta p={8} textAlign="center">
        <Text color="gray.500">{mensajeVacio}</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Table.Root variant="outline" w="100%">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Fecha</EncabezadoOscuro>
            <EncabezadoOscuro width="220px">Título</EncabezadoOscuro>
            <EncabezadoOscuro center width="90px">
              Foto
            </EncabezadoOscuro>
            <EncabezadoOscuro>Tipo</EncabezadoOscuro>
            <EncabezadoOscuro width="130px">Estado</EncabezadoOscuro>
            <EncabezadoOscuro>Reportado por</EncabezadoOscuro>
            {showActions && <EncabezadoOscuro center>Acciones</EncabezadoOscuro>}
          </FilaEncabezado>
        </Table.Header>

        <Table.Body>
          {incidentes.map((incidente) => (
            <IncidenteItem
              key={incidente.id}
              incidente={incidente}
              onCerrar={onCerrar}
              onReabrir={onReabrir}
              onVer={onVer}
              showActions={showActions}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}