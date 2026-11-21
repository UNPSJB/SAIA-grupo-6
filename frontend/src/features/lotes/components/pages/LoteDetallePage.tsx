import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  HStack,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { LuCircleCheck, LuNetwork } from "react-icons/lu";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { MotivoDialog } from "../../../../common/components/MotivoDialog";
import { useAuth } from "../../../../common/context/useAuth";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFecha, formatoFechaHora, hoyISO } from "../../../../common/utils/fechas";
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
  EtiquetaEstado,
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
import {
  cancelarLote,
  completarItem,
  obtenerLote,
} from "../../services/loteService";
import { useSalidas } from "../../../salidas/hooks/useSalidas";
import { ModalReservarLote } from "../../../salidas/components/ModalReservarLote";
import { ModalIniciarRetiro } from "../../../retiros/components/ModalIniciarRetiro";
import { obtenerRetiro } from "../../../retiros/services/retiroService";
import type { RetiroDetalle } from "../../../retiros/types/retiro";
import { LoteProgressTracker } from "../LoteProgressTracker";
import type { ItemChecklist, LoteDetalle } from "../../types/lote";
import { esLoteCerrado } from "../../types/lote";
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
    <Tarjeta p="5" borderColor={item.completado ? "green.border" : "border.subtle"}>
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
              <Table.Row>
                <Table.ColumnHeader fontSize="sm">Insumo</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm" textAlign="right">Planificado</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm" textAlign="right">Consumo real</Table.ColumnHeader>
                <Table.ColumnHeader fontSize="sm" textAlign="right">Desperdicio</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {item.insumos.map((i) => {
                const excede = Number(i.consumo_real) > Number(i.cantidad_planificada);
                return (
                  <Table.Row key={i.insumo_id}>
                    <Celda>{i.insumo_nombre}</Celda>
                    <Celda numero>{cantidadConUnidad(i.cantidad_planificada, i.unidad)}</Celda>
                    <Celda numero color={excede ? "orange.fg" : undefined} fontWeight={excede ? "bold" : undefined}>
                      {cantidadConUnidad(i.consumo_real, i.unidad)}
                    </Celda>
                    <Celda numero>{cantidadConUnidad(i.desperdicio, i.unidad)}</Celda>
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
function SeccionTrazabilidad({ traza, loteId }: { traza: TrazabilidadLoteProducto; loteId: number }) {
  const navigate = useNavigate();
  return (
    <SeccionDetalle
      sinMarco
      titulo="Lotes de insumo y proveedores"
      descripcion="Trazabilidad hacia atrás: de qué lote de insumo y de qué proveedor salió cada consumo."
      mb="0"
    >
      <HStack justify="flex-start" mb="3">
        <Button
          variant="outline"
          colorPalette="brand"
          size="sm"
          onClick={() => navigate(`/trazabilidad/lotes-producto/${loteId}`)}
        >
          <LuNetwork aria-hidden />
          Ver Árbol de Trazabilidad Completa
        </Button>
      </HStack>

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
                <EncabezadoOscuro numero center width="10%">
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
                  <Celda numero center>
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

const TONO_ESTADO_LOTE: Record<
  string,
  "ok" | "alerta" | "peligro" | "info" | "neutro"
> = {
  "En almacén": "neutro",
  "Con salidas parciales": "info",
  Agotado: "neutro",
  Retirado: "peligro",
};

const TONO_ESTADO_SALIDA: Record<
  string,
  "ok" | "alerta" | "peligro" | "info" | "neutro"
> = {
  RESERVADO: "info",
  DESPACHADO: "ok",
  ENTREGADO: "ok",
  CANCELADO: "peligro",
  RECHAZADA: "peligro",
};

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

  const {
    salidas: salidasDelLote,
    loading: salidasLoading,
    error: salidasError,
    recargarSalidas,
  } = useSalidas({
    lote_id: idValido ?? undefined,
  });

  // Un consumo nuevo cambia también la trazabilidad: se recargan juntas.
  const recargar = async () => {
    await Promise.all([
      recargarLote(),
      esAdmin ? recargarTraza() : Promise.resolve(),
      recargarSalidas(),
    ]);
  };

  const cerrado = lote ? esLoteCerrado(lote.estado) : false;

  const reservasDisponibles = lote
    ? Number(lote.saldo) > 0 && !lote.retirado && !cerrado
    : false;

  const [consumiendo, setConsumiendo] = useState<ItemChecklist | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [procesando, setProcesando] = useState<number | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  // Reserva de salidas
  const [modalReservar, setModalReservar] = useState(false);
  const [modalRetirar, setModalRetirar] = useState(false);

  // Retiro asociado (si el lote está retirado) para mostrar motivo y detalles
  const [retiroAsociado, setRetiroAsociado] = useState<RetiroDetalle | null>(null);

  useEffect(() => {
    if (!lote?.retiro_id) {
      setRetiroAsociado(null);
      return;
    }
    let vigente = true;
    obtenerRetiro(lote.retiro_id)
      .then((data) => {
        if (vigente) setRetiroAsociado(data);
      })
      .catch(() => {
        if (vigente) setRetiroAsociado(null);
      });
    return () => {
      vigente = false;
    };
  }, [lote?.retiro_id]);

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
    <>
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
              <DatoDetalle etiqueta="Vencimiento">
                {lote.fecha_vencimiento ? formatoFecha(lote.fecha_vencimiento) : "Sin fecha"}
              </DatoDetalle>
              <DatoDetalle etiqueta="Tareas hechas">
                {lote.items_completados} de {lote.items_total}
              </DatoDetalle>
              {lote.fecha_vencimiento && lote.fecha_vencimiento < hoyISO() && (
                <Text fontSize="xs" color="red.fg" fontWeight="bold" mt="1">
                  ⚠ Vencido
                </Text>
              )}
            </GrillaDatos>
            {lote.retirado && lote.retiro_id && (
              <Alert.Root status="error" mb="6" alignItems="flex-start">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Lote retirado del mercado</Alert.Title>
                  <Alert.Description>
                    Este lote fue retirado del mercado (Retiro #{lote.retiro_id}
                    {retiroAsociado?.motivo ? ` - Motivo: ${retiroAsociado.motivo}` : ""}, estado: {lote.retiro_estado}). No se pueden hacer nuevas reservas ni despachos sobre él.
                  </Alert.Description>
                  <HStack gap="3" flexWrap="wrap" mt="3">
                    <BotonTexto
                      onClick={() => navigate(`/retiros/${lote.retiro_id}`)}
                      title="Ver la ficha del retiro"
                    >
                      Ver retiro
                    </BotonTexto>
                  </HStack>
                </Alert.Content>
              </Alert.Root>
            )}
            {lote.motivo_cancelacion && (
              <Text fontSize="sm" color="red.fg" mt="4">
                Motivo de cancelación: {lote.motivo_cancelacion}
              </Text>
            )}
          </SeccionDetalle>

          {cerrado && (
            <AvisoSoloLectura mb="0">Lote {lote.estado}: es de solo lectura.</AvisoSoloLectura>
          )}

          {/* Línea de tiempo de elaboración y progreso */}
          <SeccionDetalle sinMarco titulo="Progreso de producción" mb="0">
            <LoteProgressTracker loteId={lote.id} />
          </SeccionDetalle>

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
              {reservasDisponibles && (
                <Button
                  colorPalette="brand"
                  onClick={() => {
                    setModalReservar(true);
                  }}
                >
                  Reservar
                </Button>
              )}
              {!reservasDisponibles && !lote.retirado && (
                <Text fontSize="sm" color="fg.muted">
                  Sin saldo disponible para reservar.
                </Text>
              )}
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
              {esAdmin && !lote.retirado && !cerrado && (
                <Button
                  colorPalette="red"
                  onClick={() => setModalRetirar(true)}
                >
                  Retirar lote del mercado
                </Button>
              )}
              {esAdmin && lote.retirado && !cerrado && (
                <Text fontSize="sm" color="fg.muted">
                  El lote ya está retirado del mercado.
                </Text>
              )}
            </HStack>
          )}

          {esAdmin && traza && <SeccionTrazabilidad traza={traza} loteId={lote.id} />}

          {/* Distribución y Stock del Lote */}
          <SeccionDetalle sinMarco titulo="Distribución y Stock del Lote" mb="0">
            <Tarjeta p="4" mb="4">
              <Stack
                direction={{ base: "column", lg: "row" }}
                justify="space-between"
                align={{ base: "stretch", lg: "flex-start" }}
                gap="6"
              >
                {/* Métricas cuantitativas */}
                <SimpleGrid
                  columns={{ base: 2, sm: 3, md: 4, xl: (Number(lote.en_revision) > 0 || Number(lote.desechado) > 0) ? 6 : 4 }}
                  gap="4"
                  flex="1"
                >
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Producido
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" color="fg">
                      {cantidadConUnidad(lote.cantidad_producida, lote.unidad)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Saldo disponible
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color={Number(lote.saldo) > 0 ? "green.600" : "fg"}
                    >
                      {cantidadConUnidad(lote.saldo, lote.unidad)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Reservado
                    </Text>
                    <HStack gap="1" align="baseline">
                      <Text fontSize="sm" fontWeight="medium" color="fg">
                        {cantidadConUnidad(lote.reservado, lote.unidad)}
                      </Text>
                      {Number(lote.reservado) > 0 && (
                        <Badge size="xs" colorPalette="blue" variant="subtle">
                          Asignado
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                  <Box>
                    <Text fontSize="xs" color="fg.muted" mb="1">
                      Despachado / Entregado
                    </Text>
                    <Text fontSize="sm" fontWeight="medium" color="fg">
                      {cantidadConUnidad(Number(lote.despachado) + Number(lote.entregado), lote.unidad)}
                    </Text>
                    <Text fontSize="2xs" color="fg.subtle">
                      {cantidadConUnidad(lote.despachado, lote.unidad)} desp. · {cantidadConUnidad(lote.entregado, lote.unidad)} entr.
                    </Text>
                  </Box>
                  {Number(lote.en_revision) > 0 && (
                    <Box>
                      <Text fontSize="xs" color="fg.muted" mb="1">
                        En revisión
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" color="orange.fg">
                        {cantidadConUnidad(lote.en_revision, lote.unidad)}
                      </Text>
                    </Box>
                  )}
                  {Number(lote.desechado) > 0 && (
                    <Box>
                      <Text fontSize="xs" color="fg.muted" mb="1">
                        Desechado
                      </Text>
                      <Text fontSize="sm" fontWeight="medium" color="red.fg">
                        {cantidadConUnidad(lote.desechado, lote.unidad)}
                      </Text>
                    </Box>
                  )}
                </SimpleGrid>

                {/* Estado comercial a la derecha perfectamente alineado a la izquierda de su columna */}
                <Box
                  pl={{ base: "0", lg: "6" }}
                  pt={{ base: "3", lg: "0" }}
                  borderLeftWidth={{ base: "0", lg: "1px" }}
                  borderTopWidth={{ base: "1px", lg: "0" }}
                  borderColor="border.subtle"
                  minW={{ base: "auto", lg: "180px" }}
                  textAlign="left"
                >
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Estado comercial
                  </Text>
                  <Box display="inline-flex">
                    <EtiquetaEstado
                      tono={
                        TONO_ESTADO_LOTE[lote.estado_lote] ?? "neutro"
                      }
                    >
                      {lote.estado_lote}
                    </EtiquetaEstado>
                  </Box>
                </Box>
              </Stack>
            </Tarjeta>

            {salidasLoading && <EstadoCargando>Cargando salidas...</EstadoCargando>}
            {salidasError && <BannerError>{salidasError}</BannerError>}
            {!salidasLoading && !salidasError && salidasDelLote.length === 0 && (
              <EstadoVacio>
                Este lote aún no tiene salidas ni reservas asignadas a clientes.
              </EstadoVacio>
            )}
            {!salidasLoading && !salidasError && salidasDelLote.length > 0 && (
              <Tarjeta overflowX="auto">
                <Table.Root variant="outline" w="100%" minW="720px">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader px="4" py="3">Fecha</Table.ColumnHeader>
                      <Table.ColumnHeader px="4" py="3">Cliente</Table.ColumnHeader>
                      <Table.ColumnHeader px="4" py="3" textAlign="right">
                        Cantidad
                      </Table.ColumnHeader>
                      <Table.ColumnHeader px="4" py="3">Estado</Table.ColumnHeader>
                      <Table.ColumnHeader px="4" py="3" textAlign="center" width="80px">
                        Acción
                      </Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {salidasDelLote.map((salida) => (
                      <Table.Row
                        key={salida.id}
                        borderBottomWidth="1px"
                        borderColor="border.subtle"
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                        onClick={() => navigate(`/salidas/${salida.id}/detalle`)}
                      >
                        <Celda p="3">
                          <Text fontSize="sm" color="fg">
                            {formatoFecha(salida.fecha_reserva)}
                          </Text>
                        </Celda>
                        <Celda p="3">
                          <Text fontSize="sm" fontWeight="medium" color="fg">
                            {salida.cliente_nombre}
                          </Text>
                        </Celda>
                        <Celda p="3" textAlign="right">
                          <Text fontSize="sm" color="fg">
                            {cantidadConUnidad(salida.cantidad, lote.unidad)}
                          </Text>
                        </Celda>
                        <Celda p="3">
                          <EtiquetaEstado
                            tono={
                              TONO_ESTADO_SALIDA[salida.estado] ?? "neutro"
                            }
                          >
                            {salida.estado}
                          </EtiquetaEstado>
                        </Celda>
                        <Celda p="3" textAlign="center">
                          <BotonAccion
                            accion="ver"
                            label="Ver detalle de salida"
                            onClick={() => navigate(`/salidas/${salida.id}/detalle`)}
                          />
                        </Celda>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Tarjeta>
            )}
          </SeccionDetalle>
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

    <ModalReservarLote
      isOpen={modalReservar}
      loteIdInicial={lote ? lote.id : null}
      onClose={() => setModalReservar(false)}
      onReservaRegistrada={async () => {
        setModalReservar(false);
        await Promise.all([recargarLote(), recargarSalidas()]);
      }}
    />
    <ModalIniciarRetiro
      isOpen={modalRetirar}
      loteIdInicial={lote ? lote.id : null}
      onClose={() => setModalRetirar(false)}
      onRetiroIniciado={recargar}
    />
    </>
  );
}
