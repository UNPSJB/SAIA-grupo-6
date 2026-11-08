import { useNavigate, useParams } from "react-router-dom";
import { Table, Text } from "@chakra-ui/react";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { formatoCantidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { DatoDetalle, GrillaDatos, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { BadgeEstadoLote } from "../../../lotes/components/BadgeEstadoLote";
import { trazarLoteInsumo } from "../../services/trazabilidadService";

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
      volver={{ a: "/trazabilidad", etiqueta: "Trazabilidad" }}
      titulo={traza ? `Lote de insumo ${traza.lote_insumo.numero_lote}` : "Lote de insumo"}
      descripcion="Lotes de producto que consumieron este lote de insumo."
    >
      {loading && <EstadoCargando>Cargando trazabilidad...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}

      {traza && (
        <>
          <SeccionDetalle titulo="Datos del lote">
            <GrillaDatos>
              <DatoDetalle etiqueta="Insumo">{traza.lote_insumo.insumo_nombre}</DatoDetalle>
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
          </SeccionDetalle>
        </>
      )}
    </PaginaDetalle>
  );
}
