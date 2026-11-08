import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, HStack, Table, Text } from "@chakra-ui/react";
import { Pagina, PestanasPagina } from "../../../../components/ui/plantillas";
import { MotivoDialog } from "../../../../common/components/MotivoDialog";
import { formatoFecha } from "../../../../common/utils/fechas";
import { cantidadConUnidad, formatoCantidad } from "../../../../common/utils/numeros";
import { BarraFiltros, FiltroSelect } from "../../../../components/ui/filtros";
import {
  BadgeEstado,
  BannerError,
  BotonAccion,
  BotonAgregar,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
  ToggleInactivos,
} from "../../../../components/ui/patrones";
import { useInsumosActivos, useStockInsumos, useStockLotes } from "../../hooks/useStockInsumos";
import { darDeBajaLoteInsumo } from "../../services/loteInsumoService";
import type { StockLoteInsumo } from "../../types/loteInsumo";

function TabStockPorInsumo() {
  const { stock, loading, error } = useStockInsumos();

  if (loading) return <EstadoCargando>Cargando stock...</EstadoCargando>;
  if (error) return <BannerError>{error}</BannerError>;
  if (stock.length === 0) return <EstadoVacio>No hay insumos registrados.</EstadoVacio>;

  return (
    <Tarjeta overflowX="auto">
      <Table.Root variant="outline" w="100%" minW="760px">
        <Table.Header>
          <FilaEncabezado>
            <EncabezadoOscuro>Insumo</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Recibido</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Consumo real</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Desperdicio</EncabezadoOscuro>
            <EncabezadoOscuro ancho="amplia">Stock actual</EncabezadoOscuro>
          </FilaEncabezado>
        </Table.Header>
        <Table.Body>
          {stock.map((s) => (
            <Table.Row key={s.insumo_id}>
              <Celda>{s.insumo_nombre}</Celda>
              <Celda>{cantidadConUnidad(s.cantidad_recibida, s.unidad)}</Celda>
              <Celda>{cantidadConUnidad(s.consumo_real, s.unidad)}</Celda>
              <Celda>{cantidadConUnidad(s.desperdicio, s.unidad)}</Celda>
              <Celda>
                <Text as="span" fontWeight="bold">
                  {cantidadConUnidad(s.stock, s.unidad)}
                </Text>
                {Number(s.stock_vencido) > 0 && (
                  <Text fontSize="xs" color="orange.fg">
                    {formatoCantidad(s.stock_vencido)} {s.unidad} vencido
                  </Text>
                )}
              </Celda>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Tarjeta>
  );
}

function TabLotes() {
  const navigate = useNavigate();
  const { insumos } = useInsumosActivos();
  const [insumo, setInsumo] = useState("");
  const [verBajas, setVerBajas] = useState(false);
  const { lotes, loading, error, recargar } = useStockLotes(
    insumo ? Number(insumo) : undefined,
    verBajas,
  );
  const [aBaja, setABaja] = useState<StockLoteInsumo | null>(null);

  return (
    <>
      <BarraFiltros
        filtros={
          <FiltroSelect
            label="Insumo"
            valor={insumo}
            onCambio={setInsumo}
            opciones={insumos.map((i) => ({ valor: String(i.id), etiqueta: i.nombre }))}
            todos="Todos los insumos"
          />
        }
        herramientas={
          <ToggleInactivos enBarra checked={verBajas} onChange={setVerBajas}>
            Ver dados de baja
          </ToggleInactivos>
        }
      />

      {error && <BannerError>{error}</BannerError>}
      {loading && <EstadoCargando>Cargando lotes...</EstadoCargando>}
      {!loading && !error && lotes.length === 0 && (
        <EstadoVacio>No hay lotes de insumo registrados.</EstadoVacio>
      )}

      {!loading && !error && lotes.length > 0 && (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="1000px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Lote</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vencimiento</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Recibido</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Saldo</EncabezadoOscuro>
                <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {lotes.map((l) => (
                <Table.Row key={l.lote_insumo_id} opacity={l.activo ? 1 : 0.65}>
                  <Celda>{l.insumo_nombre}</Celda>
                  <Celda>{l.proveedor_nombre}</Celda>
                  <Celda>
                    <Text fontFamily="mono" fontSize="sm">
                      {l.numero_lote}
                    </Text>
                  </Celda>
                  <Celda>
                    {formatoFecha(l.fecha_vencimiento)}
                    {l.vencido && (
                      <Box mt="1">
                        <BadgeEstado>Vencido</BadgeEstado>
                      </Box>
                    )}
                  </Celda>
                  <Celda>{formatoCantidad(l.cantidad_recibida)}</Celda>
                  <Celda>
                    <Text as="span" fontWeight="bold">
                      {formatoCantidad(l.saldo)}
                    </Text>
                    {!l.activo && (
                      <Text fontSize="xs" color="fg.muted">
                        Dado de baja
                      </Text>
                    )}
                  </Celda>
                  <Celda center>
                    <HStack justify="center" gap="2">
                      <BotonAccion
                        accion="historial"
                        label="Ver trazabilidad hacia adelante"
                        onClick={() => navigate(`/trazabilidad/lotes-insumo/${l.lote_insumo_id}`)}
                      />
                      {l.activo && (
                        <BotonAccion
                          accion="eliminar"
                          label="Dar de baja el lote"
                          onClick={() => setABaja(l)}
                        />
                      )}
                    </HStack>
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}

      {aBaja && (
        <MotivoDialog
          titulo={`Dar de baja el lote ${aBaja.numero_lote}`}
          mensaje="El saldo del lote deja de contar en el stock. El historial de consumos se conserva."
          etiquetaMotivo="Motivo de la baja (vencimiento, descarte...)"
          etiquetaConfirmar="Dar de baja"
          onCancel={() => setABaja(null)}
          onConfirm={async (motivo) => {
            await darDeBajaLoteInsumo(aBaja.lote_insumo_id, motivo);
            setABaja(null);
            await recargar();
          }}
        />
      )}
    </>
  );
}

export function StockInsumosPage() {
  const navigate = useNavigate();

  return (
    <Pagina
      titulo="Stock de insumos"
      descripcion="Stock calculado: lo recibido en cada lote menos los consumos y desperdicios registrados en producción."
      acciones={
        <BotonAgregar onClick={() => navigate("/lotes-insumo/nuevo")}>Recibir lote</BotonAgregar>
      }
    >
      <PestanasPagina
        pestanas={[
          { valor: "insumos", etiqueta: "Stock por insumo", contenido: <TabStockPorInsumo /> },
          { valor: "lotes", etiqueta: "Lotes recibidos", contenido: <TabLotes /> },
        ]}
      />
    </Pagina>
  );
}
