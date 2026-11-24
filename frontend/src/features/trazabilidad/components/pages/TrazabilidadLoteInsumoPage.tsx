import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Box, Button, HStack, Link, Table, Text } from "@chakra-ui/react";
import { LuTrash2, LuTriangleAlert } from "react-icons/lu";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar } from "../../../../common/api/permissions";
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
import { ModalIniciarRetiro } from "../../../retiros/components/ModalIniciarRetiro";
import { trazarLoteInsumo } from "../../services/trazabilidadService";
import type { LoteProductoUsoIngrediente } from "../../types/trazabilidad";
import { BajaLoteInsumoDialog } from "../../../lotesInsumo/components/pages/BajaLoteInsumoDialog";

export function TrazabilidadLoteInsumoPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const loteInsumoId = Number(id);
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const [modalRetiroOpen, setModalRetiroOpen] = useState(false);
  const [bajaOpen, setBajaOpen] = useState(false);

  const { registro: traza, loading, error, recargar } = useRegistro({
    cargar: trazarLoteInsumo,
    id: Number.isFinite(loteInsumoId) ? loteInsumoId : null,
    etiqueta: "la trazabilidad del lote de insumo",
  });

  const hayLotesDisponiblesParaRetiro = Boolean(
    traza &&
    traza.lotes_producto.length > 0 &&
    traza.lotes_producto.some(
      (l) =>
        !(l as { retirado?: boolean }).retirado &&
        !(l as { retiro_id?: number | null }).retiro_id
    )
  );

  // Solo un lote activo y con saldo se puede dar de baja (siempre entero).
  const puedeDarDeBaja = Boolean(traza && traza.lote_insumo.activo && Number(traza.saldo) > 0);
  const vencido = Boolean(
    traza?.lote_insumo.fecha_vencimiento && traza.lote_insumo.fecha_vencimiento < new Date().toISOString().slice(0, 10),
  );

  return (
    <>
      <PaginaDetalle
        // Ancho completo: la tabla de lotes tiene muchas columnas y con el
        // ancho fijo de las fichas quedaban márgenes vacíos a los costados.
        ancho="completo"
        // Se llega desde Stock de insumos o desde la ficha de un lote: "Volver"
        // regresa a la pantalla de origen (Stock de insumos si se entró por URL).
        volver={{ a: "/lotes-insumo", etiqueta: "Lotes de insumos", historial: true }}
        titulo={traza ? `Lote de insumo ${traza.lote_insumo.numero_lote}` : "Lote de insumo"}
        descripcion="Lotes de producto que consumieron este lote de insumo."
        acciones={
          esAdmin && traza && (puedeDarDeBaja || hayLotesDisponiblesParaRetiro) ? (
            <HStack gap="2" flexWrap="wrap">
              {puedeDarDeBaja && (
                <Button colorPalette="red" variant="outline" onClick={() => setBajaOpen(true)}>
                  <LuTrash2 aria-hidden />
                  Dar de baja el lote
                </Button>
              )}
              {hayLotesDisponiblesParaRetiro && (
                <Button colorPalette="red" variant="solid" onClick={() => setModalRetiroOpen(true)}>
                  <LuTriangleAlert aria-hidden />
                  Iniciar retiro de elaborados
                </Button>
              )}
            </HStack>
          ) : undefined
        }
      >
        {loading && <EstadoCargando>Cargando trazabilidad...</EstadoCargando>}
        {error && <BannerError>{error}</BannerError>}

        {traza && (
          <>
            <SeccionDetalle titulo="Datos del lote">
              <GrillaDatos>
                <DatoDetalle etiqueta="Ingrediente">{traza.lote_insumo.ingrediente_nombre}</DatoDetalle>
                <DatoDetalle etiqueta="Marca">
                  {traza.lote_insumo.insumo_nombre}
                  {/* La composición de la marca (su rótulo) está en su homologación. */}
                  {puedeAdministrar(user) && (
                    <Link asChild display="block" fontSize="sm" color="brand.600" mt="0.5">
                      <RouterLink to={`/insumos/${traza.lote_insumo.insumo_id}/homologacion`}>
                        Ver composición y homologación
                      </RouterLink>
                    </Link>
                  )}
                </DatoDetalle>
                <DatoDetalle etiqueta="Proveedor">
                  {traza.lote_insumo.proveedor.nombre} (matrícula {traza.lote_insumo.proveedor.matricula})
                </DatoDetalle>
                <DatoDetalle etiqueta="Ingreso">{formatoFecha(traza.lote_insumo.fecha_ingreso)}</DatoDetalle>
                <DatoDetalle etiqueta="Vencimiento">{formatoFecha(traza.lote_insumo.fecha_vencimiento)}</DatoDetalle>
                <DatoDetalle etiqueta="Recibido">{cantidadConUnidad(traza.cantidad_recibida, traza.unidad)}</DatoDetalle>
                <DatoDetalle etiqueta="Saldo">{cantidadConUnidad(traza.saldo, traza.unidad)}</DatoDetalle>
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

      <ModalIniciarRetiro
        isOpen={modalRetiroOpen}
        loteInsumoInicialId={loteInsumoId}
        onClose={() => setModalRetiroOpen(false)}
        onRetiroIniciado={() => {
          setModalRetiroOpen(false);
          void recargar();
        }}
      />
      {bajaOpen && traza && (
        <BajaLoteInsumoDialog
          lote={{
            lote_insumo_id: traza.lote_insumo.id,
            numero_lote: traza.lote_insumo.numero_lote,
            ingrediente_nombre: traza.lote_insumo.ingrediente_nombre,
            proveedor_nombre: traza.lote_insumo.proveedor.nombre,
            saldo: traza.saldo,
            unidad: traza.unidad,
            vencido,
          }}
          onConfirmado={recargar}
          onClose={() => setBajaOpen(false)}
        />
      )}
    </>
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
