import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuCircleCheck } from "react-icons/lu";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { MotivoDialog } from "../../../../common/components/MotivoDialog";
import { useAuth } from "../../../../common/context/useAuth";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad, formatoFactor } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonAccion,
  BotonCancelar,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EstadoVacio,
  FilaEncabezado,
  Tarjeta,
} from "../../../../components/ui/patrones";
import {
  AvisoSoloLectura,
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
import { trazarLoteProducto } from "../../../trazabilidad/services/trazabilidadService";
import type { TrazabilidadLoteProducto } from "../../../trazabilidad/types/trazabilidad";
import { cancelarLote, completarItem, obtenerLote } from "../../services/loteService";
import { esLoteCerrado, type ItemChecklist, type LoteDetalle } from "../../types/lote";
import { BadgeEstadoLote } from "../BadgeEstadoLote";
import { CierreLoteDialog } from "../CierreLoteDialog";
import { ConsumoDialog } from "../ConsumoDialog";

function ItemCard({
  lote,
  item,
  editable,
  procesando,
  onConsumir,
  onCompletar,
}: {
  lote: LoteDetalle;
  item: ItemChecklist;
  editable: boolean;
  procesando: boolean;
  onConsumir: () => void;
  onCompletar: () => void;
}) {
  return (
    <Tarjeta p="5" borderColor={item.completado ? "green.200" : "border.subtle"}>
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="3" mb="3">
        <Box>
          <Text fontWeight="bold" color="fg">
            {item.orden}. {item.descripcion}
          </Text>
          {item.completado ? (
            <HStack gap="1" color="green.fg" fontSize="sm" mt="1">
              <LuCircleCheck aria-hidden />
              <Text as="span">
                Hecha por {item.completado_por_nombre ?? "—"} · {formatoFechaHora(item.completado_en)}
              </Text>
            </HStack>
          ) : (
            <Text fontSize="sm" color="fg.muted" mt="1">
              Pendiente
            </Text>
          )}
        </Box>

        {editable && (
          <HStack gap="2" flexWrap="wrap">
            {item.insumos.length > 0 && (
              <BotonCancelar size="sm" onClick={onConsumir} disabled={procesando}>
                Registrar consumo
              </BotonCancelar>
            )}
            {!item.completado && (
              <Button
                size="sm"
                colorPalette="brand"
                onClick={onCompletar}
                loading={procesando}
                disabled={procesando}
              >
                <LuCircleCheck aria-hidden />
                Marcar como hecha
              </Button>
            )}
          </HStack>
        )}
      </HStack>

      {item.insumos.length > 0 && (
        <Box overflowX="auto" mb={item.consumos.length > 0 ? "4" : "0"}>
          <Table.Root variant="outline" size="sm" w="100%" minW="520px">
            <Table.Header>
              <Table.Row bg="bg.muted">
                <Table.ColumnHeader fontSize="sm">Insumo</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm">Planificado</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm">Consumo real</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm">Desperdicio</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {item.insumos.map((i) => {
                const excede = Number(i.consumo_real) > Number(i.cantidad_planificada);
                return (
                  <Table.Row key={i.insumo_id}>
                    <Celda>{i.insumo_nombre}</Celda>
                    <Celda>{cantidadConUnidad(i.cantidad_planificada, i.unidad)}</Celda>
                    <Celda color={excede ? "orange.fg" : undefined} fontWeight={excede ? "bold" : undefined}>
                      {cantidadConUnidad(i.consumo_real, i.unidad)}
                    </Celda>
                    <Celda>{cantidadConUnidad(i.desperdicio, i.unidad)}</Celda>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {item.consumos.length > 0 && (
        <Stack gap="1">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Consumos registrados
          </Text>
          {item.consumos.map((c) => {
            const unidad = item.insumos.find((i) => i.insumo_id === c.insumo_id)?.unidad;
            return (
              <HStack key={c.id} gap="2" fontSize="sm" color="fg.muted" flexWrap="wrap">
                <Badge colorPalette={c.tipo === "real" ? "gray" : "orange"} variant="subtle">
                  {c.tipo === "real" ? "Real" : "Desperdicio"}
                </Badge>
                <Text as="span" color="fg">
                  {c.insumo_nombre}: {cantidadConUnidad(c.cantidad, unidad)}
                </Text>
                <Text as="span">
                  · lote {c.numero_lote_insumo} ({c.proveedor_nombre}) · {c.registrado_por_nombre ?? "—"},{" "}
                  {formatoFechaHora(c.registrado_en)}
                </Text>
                {c.motivo && <Text as="span">· {c.motivo}</Text>}
              </HStack>
            );
          })}
        </Stack>
      )}

      {item.insumos.length === 0 && (
        <Text fontSize="sm" color="fg.subtle">
          Esta tarea no usa insumos de la receta (v{lote.version_numero}).
        </Text>
      )}
    </Tarjeta>
  );
}

/**
 * Lotes de insumo usados y sus proveedores: lo que antes era la pantalla
 * aparte "Trazabilidad del lote". Esa pantalla repetía los datos del lote y
 * las tareas con sus consumos, y las dos se enlazaban entre sí ("Ver
 * trazabilidad" ↔ "Abrir lote"): un ida y vuelta para ver la misma ficha.
 * Ahora lo único que aportaba —vencimiento, proveedor y matrícula de cada
 * lote de insumo— vive acá. Solo para administración: el endpoint lo es.
 */
function SeccionTrazabilidad({ traza }: { traza: TrazabilidadLoteProducto }) {
  const navigate = useNavigate();
  return (
    <SeccionDetalle
      sinMarco
      titulo="Lotes de insumo y proveedores"
      descripcion="Trazabilidad hacia atrás: de qué lote de insumo y de qué proveedor salió cada consumo."
      mb="0"
    >
      {traza.lotes_insumo.length === 0 ? (
        <EstadoVacio>Todavía no hay consumos registrados.</EstadoVacio>
      ) : (
        <Tarjeta overflowX="auto">
          <Table.Root variant="outline" w="100%" minW="720px">
            <Table.Header>
              <FilaEncabezado>
                <EncabezadoOscuro>Insumo</EncabezadoOscuro>
                <EncabezadoOscuro ancho="amplia">Lote de insumo</EncabezadoOscuro>
                <EncabezadoOscuro ancho="media">Vence</EncabezadoOscuro>
                <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                <EncabezadoOscuro center width="10%">
                  Usos
                </EncabezadoOscuro>
              </FilaEncabezado>
            </Table.Header>
            <Table.Body>
              {traza.lotes_insumo.map((l) => (
                <Table.Row key={l.id}>
                  <Celda>{l.insumo_nombre}</Celda>
                  <Celda>
                    <Text fontFamily="mono" fontSize="sm">
                      {l.numero_lote}
                    </Text>
                  </Celda>
                  <Celda>{formatoFecha(l.fecha_vencimiento)}</Celda>
                  <Celda>
                    {l.proveedor.nombre}
                    <Text fontSize="xs" color="fg.muted">
                      Matrícula {l.proveedor.matricula}
                    </Text>
                  </Celda>
                  <Celda center>
                    <BotonAccion
                      accion="historial"
                      label="Ver en qué otros lotes de producto se usó"
                      onClick={() => navigate(`/trazabilidad/lotes-insumo/${l.id}`)}
                    />
                  </Celda>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Tarjeta>
      )}
    </SeccionDetalle>
  );
}

export function LoteDetallePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { id } = useParams<{ id: string }>();
  const loteId = Number(id);

  const idValido = Number.isFinite(loteId) ? loteId : null;
  const { registro: lote, loading, error, recargar: recargarLote } = useRegistro({
    cargar: obtenerLote,
    id: idValido,
    etiqueta: "el lote",
  });
  // Trazabilidad: solo administración (el endpoint lo exige).
  const { registro: traza, recargar: recargarTraza } = useRegistro({
    cargar: trazarLoteProducto,
    id: esAdmin ? idValido : null,
    etiqueta: "la trazabilidad del lote",
  });
  // Un consumo nuevo cambia también la trazabilidad: se recargan juntas.
  const recargar = async () => {
    await Promise.all([recargarLote(), esAdmin ? recargarTraza() : Promise.resolve()]);
  };

  const [consumiendo, setConsumiendo] = useState<ItemChecklist | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cerrado = lote ? esLoteCerrado(lote.estado) : false;
  const checklistCompleto = lote
    ? lote.checklist.every((i) => i.completado)
    : false;

  const completar = async (item: ItemChecklist) => {
    if (!lote) return;
    setProcesando(item.id);
    setErrorAccion(null);
    try {
      await completarItem(lote.id, item.id);
      await recargar();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo completar la tarea.");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <PaginaDetalle
      // Se llega desde la lista, desde un lote de insumo o desde Trazabilidad:
      // "Volver" regresa a la pantalla de origen.
      volver={{ a: "/lotes", etiqueta: "Lotes", historial: true }}
      titulo={lote ? `Lote ${lote.numero_lote}` : "Lote"}
      estado={lote ? <BadgeEstadoLote estado={lote.estado} /> : undefined}
      descripcion={
        lote
          ? `${lote.producto_nombre} · receta ${lote.version_numero ? `v${lote.version_numero}` : "sin versión (lote histórico)"}`
          : undefined
      }
    >
      {loading && !lote && <EstadoCargando>Cargando lote...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}

      {lote && (
        <Stack gap="6">
          <SeccionDetalle titulo="Datos del lote" mb="0">
            <GrillaDatos>
              <DatoDetalle etiqueta="Cantidad objetivo">
                {cantidadConUnidad(lote.cantidad_objetivo, lote.unidad)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Escala de la receta">
                {formatoFactor(lote.factor_escala)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Cantidad producida">
                {lote.cantidad_producida ? cantidadConUnidad(lote.cantidad_producida, lote.unidad) : "-"}
              </DatoDetalle>
              {traza?.receta && (
                <DatoDetalle etiqueta="Receta usada">
                  <BotonTexto onClick={() => navigate(`/recetas/${traza.receta!.receta_id}`)}>
                    Versión {traza.receta.version_numero}
                  </BotonTexto>
                  <Text fontSize="xs" color="fg.muted" fontWeight="normal">
                    Creada el {formatoFecha(traza.receta.creada_en)}
                    {traza.receta.creada_por ? ` por ${traza.receta.creada_por.nombre}` : ""}
                  </Text>
                </DatoDetalle>
              )}
              <DatoDetalle etiqueta="Creado por">{lote.creado_por_nombre ?? "-"}</DatoDetalle>
              <DatoDetalle etiqueta="Inicio">{formatoFechaHora(lote.fecha_inicio)}</DatoDetalle>
              {lote.fecha_cierre && <DatoDetalle etiqueta="Cierre">{formatoFechaHora(lote.fecha_cierre)}</DatoDetalle>}
              <DatoDetalle etiqueta="Tareas hechas">
                {lote.items_completados} de {lote.items_total}
              </DatoDetalle>
            </GrillaDatos>
            {lote.motivo_cancelacion && (
              <Text fontSize="sm" color="red.fg" mt="4">
                Motivo de cancelación: {lote.motivo_cancelacion}
              </Text>
            )}
          </SeccionDetalle>

          {cerrado && (
            <AvisoSoloLectura mb="0">Lote {lote.estado}: es de solo lectura.</AvisoSoloLectura>
          )}

          <SeccionDetalle sinMarco titulo="Tareas" mb="0">
          <Stack gap="4">
            {lote.checklist.length === 0 && (
              <Tarjeta p="6" textAlign="center">
                <Text color="fg.muted">Este lote no tiene tareas (lote histórico anterior a las recetas).</Text>
              </Tarjeta>
            )}
            {lote.checklist.map((item) => (
              <ItemCard
                key={item.id}
                lote={lote}
                item={item}
                editable={!cerrado}
                procesando={procesando === item.id}
                onConsumir={() => setConsumiendo(item)}
                onCompletar={() => completar(item)}
              />
            ))}
          </Stack>
          </SeccionDetalle>

          {!cerrado && (
            <HStack gap="3" flexWrap="wrap" pt="2">
              <Button
                colorPalette="brand"
                onClick={() => setCerrando(true)}
                disabled={!checklistCompleto}
                title={checklistCompleto ? undefined : "Completá todas las tareas para cerrar el lote"}
              >
                Cerrar lote
              </Button>
              {!checklistCompleto && (
                <Text fontSize="sm" color="fg.muted">
                  Completá todas las tareas para poder cerrarlo.
                </Text>
              )}
              {esAdmin && (
                <Button
                  variant="outline"
                  colorPalette="red"
                  ml="auto"
                  onClick={() => setCancelando(true)}
                >
                  Cancelar lote
                </Button>
              )}
            </HStack>
          )}

          {esAdmin && traza && <SeccionTrazabilidad traza={traza} />}
        </Stack>
      )}

      {lote && consumiendo && (
        <ConsumoDialog
          loteId={lote.id}
          item={consumiendo}
          onRegistrado={recargar}
          onClose={() => setConsumiendo(null)}
        />
      )}

      {lote && cerrando && (
        <CierreLoteDialog lote={lote} onCerrado={recargar} onClose={() => setCerrando(false)} />
      )}

      {lote && cancelando && (
        <MotivoDialog
          titulo={`Cancelar el lote ${lote.numero_lote}`}
          mensaje="El lote queda cancelado y de solo lectura. Lo consumido hasta ahora se conserva en el historial."
          etiquetaMotivo="Motivo de la cancelación"
          etiquetaConfirmar="Cancelar lote"
          onCancel={() => setCancelando(false)}
          onConfirm={async (motivo) => {
            await cancelarLote(lote.id, motivo);
            setCancelando(false);
            await recargar();
          }}
        />
      )}
    </PaginaDetalle>
  );
}
