import { useNavigate, useParams } from "react-router-dom";
import { Box, HStack, Heading, Table, Text } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { formatoCantidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  BotonVolver,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { BadgeEstadoLote } from "../../../lotes/components/BadgeEstadoLote";
import { trazarLoteInsumo } from "../../services/trazabilidadService";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted">
        {etiqueta}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="fg">
        {children}
      </Text>
    </Box>
  );
}

export function TrazabilidadLoteInsumoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const loteInsumoId = Number(id);

  const { registro: traza, loading, error } = useRegistro({
    cargar: trazarLoteInsumo,
    id: Number.isFinite(loteInsumoId) ? loteInsumoId : null,
    etiqueta: "la trazabilidad del lote de insumo",
  });

  return (
    <Box p="5" maxW="1000px" mx="auto">
      <PageHeader
        title={traza ? `Lote de insumo ${traza.lote_insumo.numero_lote}` : "Lote de insumo"}
        description="Lotes de producto que consumieron este lote de insumo."
        actions={<BotonVolver onClick={() => navigate("/trazabilidad")}>Volver</BotonVolver>}
      />

      {loading && <EstadoCargando>Cargando trazabilidad...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {traza && (
        <>
          <Tarjeta p="5" mb="6">
            <HStack gap="8" flexWrap="wrap" align="flex-start">
              <Dato etiqueta="Insumo">{traza.lote_insumo.insumo_nombre}</Dato>
              <Dato etiqueta="Proveedor">
                {traza.lote_insumo.proveedor.nombre} (matrícula {traza.lote_insumo.proveedor.matricula})
              </Dato>
              <Dato etiqueta="Ingreso">{formatoFecha(traza.lote_insumo.fecha_ingreso)}</Dato>
              <Dato etiqueta="Vencimiento">{formatoFecha(traza.lote_insumo.fecha_vencimiento)}</Dato>
              <Dato etiqueta="Recibido">{formatoCantidad(traza.cantidad_recibida)}</Dato>
              <Dato etiqueta="Saldo">{formatoCantidad(traza.saldo)}</Dato>
              <Dato etiqueta="Estado">{traza.lote_insumo.activo ? "Activo" : "Dado de baja"}</Dato>
            </HStack>
          </Tarjeta>

          <Heading as="h3" size="md" mb="3" color="brand.fg">
            Lotes de producto que lo usaron
          </Heading>

          {traza.lotes_producto.length === 0 ? (
            <EstadoVacio>Este lote de insumo todavía no se usó en ningún lote de producto.</EstadoVacio>
          ) : (
            <Tarjeta overflowX="auto">
              <Table.Root variant="outline" w="100%" minW="760px">
                <Table.Header>
                  <FilaEncabezado>
                    <EncabezadoOscuro ancho="amplia">Número de lote</EncabezadoOscuro>
                    <EncabezadoOscuro>Producto</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media">Fecha</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="angosta">Estado</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media">Consumo real</EncabezadoOscuro>
                    <EncabezadoOscuro ancho="media">Desperdicio</EncabezadoOscuro>
                    <EncabezadoOscuro center ancho="angosta">
                      Ver
                    </EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {traza.lotes_producto.map((l) => (
                    <Table.Row key={l.lote_producto_id}>
                      <Celda>
                        <Text fontFamily="mono" fontSize="sm">
                          {l.numero_lote}
                        </Text>
                      </Celda>
                      <Celda>{l.producto_nombre}</Celda>
                      <Celda>{formatoFechaHora(l.fecha_inicio)}</Celda>
                      <Celda>
                        <BadgeEstadoLote estado={l.estado} />
                      </Celda>
                      <Celda>{formatoCantidad(l.consumo_real)}</Celda>
                      <Celda>{formatoCantidad(l.desperdicio)}</Celda>
                      <Celda center>
                        <BotonAccion
                          accion="historial"
                          label="Ver trazabilidad hacia atrás del lote"
                          onClick={() => navigate(`/trazabilidad/lotes-producto/${l.lote_producto_id}`)}
                        />
                      </Celda>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
          )}
        </>
      )}
    </Box>
  );
}
