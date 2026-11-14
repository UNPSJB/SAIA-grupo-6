import { Table, Text } from "@chakra-ui/react";
import { formatoFechaHora } from "../../../common/utils/fechas";
import {
  BannerError,
  Celda,
  EstadoCargando,
  EtiquetaEstado,
  Tarjeta,
} from "../../../components/ui/patrones";
import type { HitoLote } from "../../salidas/types/salida";

/** Color de la etiqueta por tipo de evento de la línea de tiempo. */
const TONO_EVENTO: Record<string, "ok" | "alerta" | "peligro" | "info" | "neutro"> = {
  RESERVA: "info",
  DESPACHO: "info",
  ENTREGA: "ok",
  CANCELACION: "neutro",
  RECHAZO: "peligro",
  DISPOSICION: "ok",
  RECLAMO: "alerta",
};

/** Texto legible del evento; si aparece uno nuevo se muestra tal cual. */
const ETIQUETA_EVENTO: Record<string, string> = {
  RESERVA: "Reserva",
  DESPACHO: "Despacho",
  ENTREGA: "Entrega",
  CANCELACION: "Cancelación",
  RECHAZO: "Rechazo",
  DISPOSICION: "Disposición",
  RECLAMO: "Reclamo de cliente",
};

interface LoteTimelineProps {
  hitos: HitoLote[];
  loading: boolean;
  error: string | null;
}

export function LoteTimeline({
  hitos,
  loading,
  error,
}: LoteTimelineProps) {
  if (loading) {
    return <EstadoCargando>Cargando hitos...</EstadoCargando>;
  }

  if (error) {
    return <BannerError>{error}</BannerError>;
  }

  if (hitos.length === 0) {
    return (
      <Tarjeta p="6" textAlign="center">
        <Text color="fg.muted">Todavía no hay hitos registrados para este lote.</Text>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="720px">
        <Table.Header>
          <Table.Row bg="bg.muted">
            <Table.ColumnHeader px="4" py="3">Fecha y hora</Table.ColumnHeader>
            <Table.ColumnHeader px="4" py="3">Tipo de evento</Table.ColumnHeader>
            <Table.ColumnHeader px="4" py="3">Descripción</Table.ColumnHeader>
            <Table.ColumnHeader px="4" py="3">Usuario</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {hitos.map((hito) => (
            <Table.Row key={hito.id} borderBottomWidth="1px" borderColor="border.subtle">
              <Celda p="3">
                <Text fontSize="sm" color="fg">
                  {formatoFechaHora(hito.fecha_hora)}
                </Text>
              </Celda>
              <Celda p="3">
                <EtiquetaEstado tono={TONO_EVENTO[hito.tipo_evento] ?? "info"}>
                  {ETIQUETA_EVENTO[hito.tipo_evento] ?? hito.tipo_evento}
                </EtiquetaEstado>
              </Celda>
              <Celda p="3">
                <Text fontSize="sm" color="fg">{hito.descripcion}</Text>
              </Celda>
              <Celda p="3">
                <Text fontSize="sm" color="fg">
                  {hito.usuario_nombre ?? "—"}
                </Text>
              </Celda>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}
