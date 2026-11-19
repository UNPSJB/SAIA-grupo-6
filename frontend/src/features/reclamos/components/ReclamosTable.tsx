import { Badge, Box, Flex, HStack, Table, Text } from "@chakra-ui/react";
import { formatoFecha } from "../../../common/utils/fechas";
import {
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EtiquetaEstado,
  FilaEncabezado,
  Tarjeta,
  DatoPrincipal,
  FilaClickeable,
} from "../../../components/ui/patrones";
import {
  MOTIVO_AFECTACION_SALUD,
  type ReclamoResumen,
} from "../types/reclamo";

interface ReclamosTableProps {
  reclamos: ReclamoResumen[];
  onVerDetalle: (reclamoId: number) => void;
  onVerIncidente: (incidenteId: number) => void;
}

/**
 * Tabla del listado de reclamos de clientes.
 *
 * La fila NO es clickeable: la navegación vive en la columna Acciones, con
 * `BotonAccion` (`ver` para la ficha y `resolver` para el incidente en E6).
 */
export function ReclamosTable({
  reclamos,
  onVerDetalle,
  onVerIncidente,
}: ReclamosTableProps) {
  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="1120px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro width="9%">Fecha</EncabezadoOscuro>
            <EncabezadoOscuro width="13%">Cliente</EncabezadoOscuro>
            <EncabezadoOscuro width="16%">Producto / Lote</EncabezadoOscuro>
            <EncabezadoOscuro width="9%">Entrega</EncabezadoOscuro>
            <EncabezadoOscuro>Motivo</EncabezadoOscuro>
            <EncabezadoOscuro center width="14%">Plazo</EncabezadoOscuro>
            <EncabezadoOscuro center width="11%">Estado</EncabezadoOscuro>
            <EncabezadoOscuro center width="10%">
              Acciones
            </EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {reclamos.map((reclamo) => (
            <FilaClickeable key={reclamo.id} onAbrir={() => onVerDetalle(reclamo.id)}>
              <Celda whiteSpace="nowrap">
                {formatoFecha(reclamo.fecha_reclamo)}
              </Celda>
              <Celda>
                <Text fontWeight="medium" color="fg" fontSize="sm">
                  {reclamo.cliente_nombre}
                </Text>
              </Celda>
              <Celda>
                <DatoPrincipal titulo={reclamo.producto_nombre} codigo={reclamo.lote_numero} />
              </Celda>
              <Celda whiteSpace="nowrap">
                {formatoFecha(reclamo.fecha_entrega)}
              </Celda>
              <Celda>
                <HStack gap="2" flexWrap="wrap">
                  <Text fontSize="sm" color="fg">
                    {reclamo.motivo_label}
                  </Text>
                  {reclamo.motivo === MOTIVO_AFECTACION_SALUD && (
                    <Badge colorPalette="red" variant="subtle" size="xs">
                      Prioridad
                    </Badge>
                  )}
                </HStack>
              </Celda>
              <Celda center whiteSpace="nowrap">
                <Badge
                  colorPalette={reclamo.fuera_de_plazo ? "orange" : "green"}
                  variant="subtle"
                  rounded="full"
                >
                  {reclamo.fuera_de_plazo ? "Fuera de plazo" : "En plazo"} (
                  {reclamo.dias_desde_entrega}{" "}
                  {reclamo.dias_desde_entrega === 1 ? "día" : "días"})
                </Badge>
              </Celda>
              <Celda center>
                <EtiquetaEstado
                  tono={reclamo.incidente_estado === "cerrado" ? "ok" : "alerta"}
                >
                  {reclamo.incidente_estado === "cerrado" ? "Cerrado" : "Abierto"}
                </EtiquetaEstado>
              </Celda>
              <Celda center>
                <Flex justify="center" gap="2" flexWrap="wrap">
                  <BotonAccion
                    accion="ver"
                    label="Ver detalle"
                    onClick={() => onVerDetalle(reclamo.id)}
                  />
                  {reclamo.incidente_id && (
                    <BotonAccion
                      accion="resolver"
                      label="Ver incidente"
                      onClick={() => onVerIncidente(reclamo.incidente_id!)}
                    />
                  )}
                </Flex>
              </Celda>
            </FilaClickeable>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}

/** Bloque reutilizable con el badge de plazo de un reclamo. */
export function BadgePlazo({
  dias,
  fueraDePlazo,
}: {
  dias: number;
  fueraDePlazo: boolean;
}) {
  return (
    <Badge
      colorPalette={fueraDePlazo ? "orange" : "green"}
      variant="subtle"
      alignSelf="flex-start"
    >
      {fueraDePlazo ? "Fuera de plazo" : "En plazo"} ({dias}{" "}
      {dias === 1 ? "día" : "días"})
    </Badge>
  );
}

/** Nota de prioridad para los reclamos de posible afectación a la salud. */
export function BadgePrioridad({ motivo }: { motivo: string }) {
  if (motivo !== MOTIVO_AFECTACION_SALUD) return null;
  return (
    <Box as="span">
      <Badge colorPalette="red" variant="solid" size="sm">
        Prioridad
      </Badge>
    </Box>
  );
}
