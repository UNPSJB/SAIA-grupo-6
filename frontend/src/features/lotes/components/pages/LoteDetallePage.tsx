import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Box, Button, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { LuCircleCheck, LuLock } from "react-icons/lu";
import { puedeAdministrar } from "../../../../common/api/permissions";
import { MotivoDialog } from "../../../../common/components/MotivoDialog";
import { useAuth } from "../../../../common/context/useAuth";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import { formatoFechaHora } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import {
  BannerError,
  BotonCancelar,
  BotonVolver,
  Celda,
  EstadoCargando,
  PageHeader,
  Tarjeta,
} from "../../../../components/ui/patrones";
import { cancelarLote, completarItem, obtenerLote } from "../../services/loteService";
import { esLoteCerrado, type ItemChecklist, type LoteDetalle } from "../../types/lote";
import { BadgeEstadoLote } from "../BadgeEstadoLote";
import { CierreLoteDialog } from "../CierreLoteDialog";
import { ConsumoDialog } from "../ConsumoDialog";

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

export function LoteDetallePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const { id } = useParams<{ id: string }>();
  const loteId = Number(id);

  const { registro: lote, loading, error, recargar } = useRegistro({
    cargar: obtenerLote,
    id: Number.isFinite(loteId) ? loteId : null,
    etiqueta: "el lote",
  });

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
    <Box p="5" maxW="1000px" mx="auto">
      <PageHeader
        title={lote ? `Lote ${lote.numero_lote}` : "Lote"}
        description={
          lote
            ? `${lote.producto_nombre} · receta ${lote.version_numero ? `v${lote.version_numero}` : "sin versión (lote histórico)"}`
            : undefined
        }
        actions={
          <>
            <BotonVolver onClick={() => navigate("/lotes")}>Volver a la lista</BotonVolver>
            {esAdmin && lote && (
              <BotonCancelar onClick={() => navigate(`/trazabilidad/lotes-producto/${lote.id}`)}>
                Ver trazabilidad
              </BotonCancelar>
            )}
          </>
        }
      />

      {loading && !lote && <EstadoCargando>Cargando lote...</EstadoCargando>}
      {error && <BannerError>{error}</BannerError>}
      {errorAccion && <BannerError>{errorAccion}</BannerError>}

      {lote && (
        <Stack gap="6">
          <Tarjeta p="5">
            <HStack gap="8" flexWrap="wrap" align="flex-start">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Estado
                </Text>
                <BadgeEstadoLote estado={lote.estado} />
              </Box>
              <Dato etiqueta="Cantidad objetivo">
                {cantidadConUnidad(lote.cantidad_objetivo, lote.unidad)}
              </Dato>
              <Dato etiqueta="Escala de la receta">
                {lote.factor_escala ? `×${Number(lote.factor_escala).toLocaleString("es-AR", { maximumFractionDigits: 3 })}` : "-"}
              </Dato>
              <Dato etiqueta="Cantidad producida">
                {lote.cantidad_producida ? cantidadConUnidad(lote.cantidad_producida, lote.unidad) : "-"}
              </Dato>
              <Dato etiqueta="Creado por">{lote.creado_por_nombre ?? "-"}</Dato>
              <Dato etiqueta="Inicio">{formatoFechaHora(lote.fecha_inicio)}</Dato>
              {lote.fecha_cierre && <Dato etiqueta="Cierre">{formatoFechaHora(lote.fecha_cierre)}</Dato>}
              <Dato etiqueta="Tareas hechas">
                {lote.items_completados} de {lote.items_total}
              </Dato>
            </HStack>
            {lote.motivo_cancelacion && (
              <Text fontSize="sm" color="red.fg" mt="4">
                Motivo de cancelación: {lote.motivo_cancelacion}
              </Text>
            )}
          </Tarjeta>

          {cerrado && (
            <HStack
              gap="2"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="md"
              px="4"
              py="3"
              fontSize="sm"
              color="fg.muted"
            >
              <LuLock aria-hidden />
              <Text as="span">Lote {lote.estado}: es de solo lectura.</Text>
            </HStack>
          )}

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
    </Box>
  );
}
