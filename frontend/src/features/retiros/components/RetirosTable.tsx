import type { ReactNode } from "react";
import { Flex, Table, Text } from "@chakra-ui/react";
import { formatoFecha } from "../../../common/utils/fechas";
import {
  BotonAccion,
  Celda,
  DatoPrincipal,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaClickeable,
  FilaEncabezado,
  ProgresoTareas,
  TarjetaTabla,
  TextoTruncado,
} from "../../../components/ui/patrones";
import type { RetiroResumen } from "../types/retiro";

interface RetirosTableProps {
  retiros: RetiroResumen[];
  /** Pie de la tarjeta (resumen y paginación, `PieTabla`). */
  pie?: ReactNode;
  onVerDetalle: (retiroId: number) => void;
}

/** Toda la fila abre el detalle; el botón "Ver detalle" queda para teclado y lectores. */
export function RetirosTable({
  retiros,
  pie,
  onVerDetalle,
}: RetirosTableProps) {
  return (
    <TarjetaTabla pie={pie}>
      <Table.Root variant="outline" w="100%" minW="980px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro width="24%">Producto / Lote</EncabezadoOscuro>
            <EncabezadoOscuro>Motivo</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="amplia">Notificados</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="media">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center width="10%">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {retiros.map((retiro) => (
            <FilaClickeable key={retiro.id} onAbrir={() => onVerDetalle(retiro.id)}>
              <Celda whiteSpace="nowrap">
                {formatoFecha(retiro.fecha_retiro)}
              </Celda>
              <Celda>
                <DatoPrincipal titulo={retiro.lote_producto_nombre} codigo={retiro.lote_codigo} />
              </Celda>
              <Celda>
                <TextoTruncado texto={retiro.motivo} />
              </Celda>
              <Celda center whiteSpace="nowrap">
                {retiro.total_afectados === 0 ? (
                  <Text fontSize="sm" color="fg.muted">Sin afectados</Text>
                ) : (
                  <ProgresoTareas hechas={retiro.notificados} total={retiro.total_afectados} />
                )}
              </Celda>
              <Celda center whiteSpace="nowrap">
                <BadgeEstadoRetiro estado={retiro.estado} />
              </Celda>
              <Celda center>
                <Flex justify="center" gap="2" flexWrap="wrap">
                  <BotonAccion
                    accion="ver"
                    label="Ver detalle"
                    onClick={() => onVerDetalle(retiro.id)}
                  />
                </Flex>
              </Celda>
            </FilaClickeable>
          ))}
        </Table.Body>
      </Table.Root>
    </TarjetaTabla>
  );
}

function BadgeEstadoRetiro({
  estado,
}: {
  estado: "EN_CURSO" | "CERRADO";
}) {
  const esCerrado = estado === "CERRADO";
  return (
    <EtiquetaEstado tono={esCerrado ? "ok" : "alerta"}>
      {esCerrado ? "Cerrado" : "En curso"}
    </EtiquetaEstado>
  );
}
