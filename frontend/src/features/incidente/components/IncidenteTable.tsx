import { Table, Text } from "@chakra-ui/react";
import { IncidenteItem } from "./IncidenteItem";
import type { Incidente } from "../types/incidente";
import type { ColumnaOrdenIncidente } from "../services/incidenteService";
import type { OrdenTabla } from "../../../common/hooks/useOrdenTabla";
import { EncabezadoOrdenable } from "../../../components/ui/filtros";
import {
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";

interface IncidenteTableProps {
  incidentes: Incidente[];
  /**
   * Orden server-side. Si se pasa, Fecha/Tipo/Estado se pueden clickear; si
   * no, la tabla se muestra con encabezados fijos (por ejemplo en un detalle).
   */
  orden?: OrdenTabla<ColumnaOrdenIncidente, string>;
  onCerrar?: (incidente: Incidente) => void;
  onReabrir?: (incidente: Incidente) => void;
  onVer?: (incidente: Incidente) => void;
  showActions?: boolean;
  mensajeVacio?: string;
}

export function IncidenteTable({
  incidentes,
  orden,
  onCerrar,
  onReabrir,
  onVer,
  showActions = true,
  mensajeVacio = "Todavía no se registraron incidentes.",
}: IncidenteTableProps) {
  if (incidentes.length === 0) {
    return (
      <Tarjeta p="8" textAlign="center">
        <Text color="fg.muted">{mensajeVacio}</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="800px">
        <Table.Header>
{/*
            "Título" y "Reportado por" no llevan ancho a propósito: son las
            columnas que se reparten lo que sobra. El título quedó sin ancho
            porque ahora muestra también la descripción y la resolución del
            incidente, no solo el nombre.
          */}
          <FilaEncabezado>
            {orden ? (
              <EncabezadoOrdenable columna="fecha" orden={orden} ancho="media">
                Fecha
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            )}
            <EncabezadoOscuro>Título</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="angosta">
              Foto
            </EncabezadoOscuro>
            {orden ? (
              <EncabezadoOrdenable columna="tipo" orden={orden} ancho="media">
                Tipo
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="media">Tipo</EncabezadoOscuro>
            )}
            {orden ? (
              <EncabezadoOrdenable columna="estado" orden={orden} ancho="media">
                Estado
              </EncabezadoOrdenable>
            ) : (
              <EncabezadoOscuro ancho="media">Estado</EncabezadoOscuro>
            )}
            <EncabezadoOscuro>Reportado por</EncabezadoOscuro>
            {showActions && <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>}
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