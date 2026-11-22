import { useNavigate, useParams } from "react-router-dom";
import { Box, Table, Text } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad, formatoCantidad, formatoFactor } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaClickeable,
  FilaEncabezado,
  Tarjeta,
  DatoPrincipal,
} from "../../../../components/ui/patrones";
import { DatoDetalle, GrillaDatos, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { BadgeEstadoLote } from "../../../lotes/components/BadgeEstadoLote";
import { trazarLoteInsumo } from "../../services/trazabilidadService";
import type { LoteProductoUsoIngrediente } from "../../types/trazabilidad";

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
    <PaginaDetalle
      // Ancho completo: la tabla de lotes tiene muchas columnas y con el
      // ancho fijo de las fichas quedaban márgenes vacíos a los costados.
      ancho="completo"
      // Se llega desde Stock de insumos o desde la ficha de un lote: "Volver"
      // regresa a la pantalla de origen (Stock de insumos si se entró por URL).
      volver={{ a: "/stock-insumos", etiqueta: "Stock de insumos", historial: true }}
      titulo={traza ? `Lote de insumo ${traza.lote_insumo.numero_lote}` : "Lote de insumo"}
      descripcion="Lotes de producto que consumieron este lote de insumo."
    >
      {loading && <EstadoCargando>Cargando trazabilidad...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {traza && (
        <>
          <SeccionDetalle titulo="Datos del lote">
            <GrillaDatos>
              <DatoDetalle etiqueta="Ingrediente">{traza.lote_insumo.ingrediente_nombre}</DatoDetalle>
              <DatoDetalle etiqueta="Marca">{traza.lote_insumo.insumo_nombre}</DatoDetalle>
              <DatoDetalle etiqueta="Proveedor">
                {traza.lote_insumo.proveedor.nombre} (matrícula {traza.lote_insumo.proveedor.matricula})
              </DatoDetalle>
              <DatoDetalle etiqueta="Ingreso">{formatoFecha(traza.lote_insumo.fecha_ingreso)}</DatoDetalle>
              <DatoDetalle etiqueta="Vencimiento">{formatoFecha(traza.lote_insumo.fecha_vencimiento)}</DatoDetalle>
              <DatoDetalle etiqueta="Recibido">{formatoCantidad(traza.cantidad_recibida)}</DatoDetalle>
              <DatoDetalle etiqueta="Saldo">{formatoCantidad(traza.saldo)}</DatoDetalle>
              <DatoDetalle etiqueta="Estado">{traza.lote_insumo.activo ? "Activo" : "Dado de baja"}</DatoDetalle>
            </GrillaDatos>
          </SeccionDetalle>

          <SeccionDetalle sinMarco titulo="Lotes de producto que lo usaron">
          {traza.lotes_producto.length === 0 ? (
            <EstadoVacio>Este lote de insumo todavía no se usó en ningún lote de producto.</EstadoVacio>
          ) : (
            <Tarjeta overflowX="auto">
              <Table.Root variant="outline" w="100%" minW="880px">
                <Table.Header>
                  <FilaEncabezado>
                    {/* Anchos explícitos: con los presets sumaban 90% y al
                        producto le quedaba un 10%, así que el nombre se cortaba. */}
                    <EncabezadoOscuro width="13%">Número de lote</EncabezadoOscuro>
                    <EncabezadoOscuro>Producto</EncabezadoOscuro>
                    <EncabezadoOscuro width="12%">Fecha</EncabezadoOscuro>
                    <EncabezadoOscuro center width="11%">Estado</EncabezadoOscuro>
                    <EncabezadoOscuro numero width="17%">Tamaño del lote</EncabezadoOscuro>
                    <EncabezadoOscuro numero width="10%">Consumo real</EncabezadoOscuro>
                    <EncabezadoOscuro numero width="10%">Desperdicio</EncabezadoOscuro>
                    <EncabezadoOscuro center width="6%">
                      Ver
                    </EncabezadoOscuro>
                  </FilaEncabezado>
                </Table.Header>
                <Table.Body>
                  {traza.lotes_producto.map((l) => (
                    <FilaClickeable onAbrir={() => navigate(`/lotes/${l.lote_producto_id}`)} key={l.lote_producto_id}>
                      <Celda>
                        <Text fontFamily="mono" fontSize="sm" color="tabla.textoSecundario">
                          {l.numero_lote}
                        </Text>
                      </Celda>
                      <Celda>
                        <DatoPrincipal titulo={l.producto_nombre} />
                      </Celda>
                      {/* Sin `nowrap`: en una columna angosta la hora pasa al
                          renglón de abajo en vez de salirse de la celda. */}
                      <Celda>{formatoFechaHora(l.fecha_inicio)}</Celda>
                      <Celda center>
                        <BadgeEstadoLote estado={l.estado} />
                      </Celda>
                      <Celda numero>
                        <TamanoLote lote={l} />
                      </Celda>
                      <Celda numero>{formatoCantidad(l.consumo_real)}</Celda>
                      <Celda numero>{formatoCantidad(l.desperdicio)}</Celda>
                      <Celda center>
                        <BotonAccion
                          accion="ver"
                          label="Abrir el lote (incluye su trazabilidad)"
                          onClick={() => navigate(`/lotes/${l.lote_producto_id}`)}
                        />
                      </Celda>
                    </FilaClickeable>
                  ))}
                </Table.Body>
              </Table.Root>
            </Tarjeta>
          )}
          </SeccionDetalle>
        </>
      )}
    </PaginaDetalle>
  );
}

/**
 * Objetivo del lote con su escala y, si ya cerró, lo producido. Con la misma
 * receta, un lote a escala ×0,5 consume la mitad que uno a ×1: sin este dato
 * la diferencia de consumo parecía un error.
 */
function TamanoLote({ lote }: { lote: LoteProductoUsoIngrediente }) {
  const detalle = [
    lote.factor_escala ? `escala ${formatoFactor(lote.factor_escala)}` : null,
    lote.cantidad_producida ? `producido ${cantidadConUnidad(lote.cantidad_producida, lote.unidad)}` : null,
  ].filter(Boolean);
  return (
    <Box>
      <Text>{cantidadConUnidad(lote.cantidad_objetivo, lote.unidad)}</Text>
      {detalle.length > 0 && (
        <Text fontSize="xs" color="tabla.textoSecundario" mt="0.5">
          {detalle.join(" · ")}
        </Text>
      )}
    </Box>
  );
}
