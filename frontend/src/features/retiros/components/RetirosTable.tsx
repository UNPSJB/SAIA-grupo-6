import { Badge, Box, Flex, Table, Text } from "@chakra-ui/react";
import { formatoFecha } from "../../../common/utils/fechas";
import {
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import type { RetiroResumen } from "../types/retiro";

interface RetirosTableProps {
  retiros: RetiroResumen[];
  onVerDetalle: (retiroId: number) => void;
}

export function RetirosTable({
  retiros,
  onVerDetalle,
}: RetirosTableProps) {
  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="1120px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Lote</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Motivo</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Notificados</EncabezadoOscuro>
            <EncabezadoOscuro ancho="media">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {retiros.map((retiro) => (
            <Table.Row key={retiro.id}>
              <Celda whiteSpace="nowrap">
                {formatoFecha(retiro.fecha_retiro)}
              </Celda>
              <Celda>
                <Box>
                  <Text fontWeight="bold" color="fg" fontSize="sm">
                    {retiro.lote_producto_nombre}
                  </Text>
                  <Text fontSize="xs" color="fg.subtle" whiteSpace="nowrap">
                    {retiro.lote_codigo}
                  </Text>
                </Box>
              </Celda>
              <Celda>
                <Text fontSize="sm" color="fg">
                  {retiro.motivo}
                </Text>
              </Celda>
              <Celda whiteSpace="nowrap">
                {retiro.total_afectados === 0 ? (
                  <Text fontSize="sm" color="fg.muted">Sin afectados</Text>
                ) : (
                  <Text fontSize="sm" color="fg">
                    {retiro.notificados} de {retiro.total_afectados}
                  </Text>
                )}
              </Celda>
              <Celda whiteSpace="nowrap">
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
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}

function BadgeEstadoRetiro({
  estado,
}: {
  estado: "EN_CURSO" | "CERRADO";
}) {
  const esCerrado = estado === "CERRADO";
  return (
    <Badge
      colorPalette={esCerrado ? "green" : "orange"}
      variant="subtle"
      whiteSpace="nowrap"
    >
      {esCerrado ? "Cerrado" : "En curso"}
    </Badge>
  );
}
