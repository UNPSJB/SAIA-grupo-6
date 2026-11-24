import { useCallback, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  Badge,
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  LuCheck,
  LuClock,
  LuFlag,
  LuLayers,
  LuPackageCheck,
  LuTriangleAlert,
  LuUser,
} from "react-icons/lu";
import { formatoFechaHora } from "../../../common/utils/fechas";
import { cantidadConUnidad, formatoPorcentajeFino } from "../../../common/utils/numeros";
import {
  BannerError,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  FilaEncabezado,
  Tarjeta,
} from "../../../components/ui/patrones";
import { getTimelineLote } from "../services/loteService";
import type {
  EstadoNodoTimeline,
  LoteTimelineResponse,
  NodoTimeline,
} from "../types/timeline";

interface LoteProgressTrackerProps {
  loteId: number;
  /**
   * Cambia cada vez que cambia el lote (etapa completada, consumo registrado,
   * corregido o borrado, cierre): la línea de tiempo se vuelve a pedir. Sin
   * esto quedaba desactualizada hasta recargar la página.
   */
  version?: string;
  /** Unidad del producto ("u", "kg"), para las cantidades de inicio y cierre. */
  unidad?: string | null;
}

const COLOR_ESTADO: Record<EstadoNodoTimeline, { palette: string; label: string }> = {
  completado: { palette: "teal", label: "Completado" },
  en_proceso: { palette: "blue", label: "En proceso" },
  pendiente: { palette: "gray", label: "Pendiente" },
};

function iconoPorTipo(tipo: NodoTimeline["tipo"], estado: EstadoNodoTimeline) {
  if (estado === "completado") {
    return <LuCheck size={18} />;
  }
  if (tipo === "inicio") {
    return <LuFlag size={18} />;
  }
  if (tipo === "cierre") {
    return <LuPackageCheck size={18} />;
  }
  if (estado === "en_proceso") {
    return <LuClock size={18} />;
  }
  return <LuLayers size={18} />;
}

export function LoteProgressTracker({ loteId, version, unidad }: LoteProgressTrackerProps) {
  const cargar = useCallback(() => getTimelineLote(loteId), [loteId]);
  const { items: data, loading, error } = useLista<LoteTimelineResponse | null>({
    cargar,
    dependencias: [loteId, version],
    valorInicial: null,
    mensajeError: "No se pudo cargar la línea de tiempo.",
    preferirMensajeDelBackend: true,
  });
  // Lo que eligió la persona; sin elección, el nodo por defecto (ver abajo).
  const [nodoElegidoId, setNodoSeleccionadoId] = useState<string | null>(null);

  // Solo la primera vez: al actualizarse se sigue mostrando la anterior (sin parpadeo).
  if (loading && !data) {
    return <EstadoCargando>Cargando progreso de producción...</EstadoCargando>;
  }

  if (error) {
    return <BannerError>{error}</BannerError>;
  }

  if (!data || data.nodos.length === 0) {
    return null;
  }

  // Por defecto: el primer nodo en proceso; si no hay, el último completado; si no, el primero.
  const porDefecto =
    data.nodos.find((n) => n.estado === "en_proceso") ??
    [...data.nodos].reverse().find((n) => n.estado === "completado") ??
    data.nodos[0];
  const nodoSeleccionado = data.nodos.find((n) => n.id === nodoElegidoId) ?? porDefecto;

  return (
    <Stack gap="5">
      {/* Tracker Horizontal Interactivo */}
      <Tarjeta p="5" overflowX="auto">
        <HStack align="flex-start" gap="0" minW="640px" py="2">
          {data.nodos.map((nodo, idx) => {
            const esSeleccionado = nodo.id === nodoSeleccionado?.id;
            const configEstado = COLOR_ESTADO[nodo.estado];
            const haySiguiente = idx < data.nodos.length - 1;
            const lineaCompletada = nodo.estado === "completado";

            return (
              <HStack key={nodo.id} flex={haySiguiente ? 1 : undefined} align="flex-start" gap="0">
                <Box
                  as="button"
                  onClick={() => setNodoSeleccionadoId(nodo.id)}
                  cursor="pointer"
                  style={{ background: "none", border: "none", padding: 0 }}
                  textAlign="center"
                  minW="100px"
                  maxW="140px"
                  _focusVisible={{ outline: "2px solid var(--chakra-colors-colorPalette-focusRing)" }}
                >
                  <VStack align="center" gap="2">
                  {/* Círculo indicador */}
                  <Box position="relative">
                    <Box
                      w="40px"
                      h="40px"
                      rounded="full"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      borderWidth="2px"
                      borderColor={
                        esSeleccionado
                          ? "blue.solid"
                          : nodo.estado === "completado"
                            ? "teal.solid"
                            : nodo.estado === "en_proceso"
                              ? "blue.solid"
                              : "border.subtle"
                      }
                      bg={
                        nodo.estado === "completado"
                          ? "teal.subtle"
                          : nodo.estado === "en_proceso"
                            ? "blue.subtle"
                            : "bg.muted"
                      }
                      color={
                        nodo.estado === "completado"
                          ? "teal.fg"
                          : nodo.estado === "en_proceso"
                            ? "blue.fg"
                            : "fg.muted"
                      }
                      boxShadow={
                        esSeleccionado
                          ? "0 0 0 3px rgba(66, 153, 225, 0.4)"
                          : nodo.estado === "en_proceso"
                            ? "0 0 0 2px rgba(66, 153, 225, 0.25)"
                            : "none"
                      }
                      transition="all 0.2s ease"
                    >
                      {iconoPorTipo(nodo.tipo, nodo.estado)}
                    </Box>

                    {/* Insignia de desvío */}
                    {nodo.tiene_desvio && (
                      <Box
                        position="absolute"
                        top="-3px"
                        right="-3px"
                        bg="orange.solid"
                        color="white"
                        rounded="full"
                        p="0.5"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        title="Desvío de material registrado"
                      >
                        <LuTriangleAlert size={12} />
                      </Box>
                    )}
                  </Box>

                  {/* Etiquetas textuales del nodo */}
                  <Stack gap="0.5" align="center">
                    <Text
                      fontSize="xs"
                      fontWeight={esSeleccionado ? "bold" : "medium"}
                      color={esSeleccionado ? "fg" : "fg.muted"}
                      lineClamp={2}
                    >
                      {nodo.titulo}
                    </Text>
                    {nodo.subtitulo && (
                      <Text fontSize="2xs" color="fg.subtle">
                        {nodo.subtitulo}
                      </Text>
                    )}
                    <Badge
                      size="xs"
                      colorPalette={configEstado.palette}
                      variant={esSeleccionado ? "solid" : "subtle"}
                    >
                      {configEstado.label}
                    </Badge>
                  </Stack>
                </VStack>
              </Box>

              {/* Línea conectora entre nodos */}
                {haySiguiente && (
                  <Box
                    flex="1"
                    h="2px"
                    mt="20px"
                    bg={lineaCompletada ? "teal.solid" : "border.subtle"}
                    transition="background 0.3s ease"
                  />
                )}
              </HStack>
            );
          })}
        </HStack>
      </Tarjeta>

      {/* Detalle del Nodo Seleccionado */}
      {nodoSeleccionado && (
        <Tarjeta p="6" bg="bg.panel" borderWidth="1px" borderColor="border.subtle">
          <Stack gap="4">
            {/* Cabecera del detalle */}
            <HStack justify="space-between" align="flex-start" wrap="wrap" gap="3">
              <Stack gap="1">
                <HStack gap="2" align="center">
                  {/* Mismo número que la lista de tareas ("3. Rellenar…"): el inicio
                      ocupa el orden 1, así que la tarea N es el nodo N+1. */}
                  <Badge size="sm" variant="outline">
                    {nodoSeleccionado.tipo === "tarea"
                      ? `Tarea ${nodoSeleccionado.orden - 1}`
                      : nodoSeleccionado.tipo === "inicio"
                        ? "Inicio"
                        : "Cierre"}
                  </Badge>
                  <Heading as="h4" size="md" color="fg">
                    {nodoSeleccionado.titulo}
                  </Heading>
                  {nodoSeleccionado.subtitulo && (
                    <Text fontSize="sm" color="fg.muted">
                      · {nodoSeleccionado.subtitulo}
                    </Text>
                  )}
                </HStack>
                {nodoSeleccionado.detalle.descripcion &&
                  nodoSeleccionado.detalle.descripcion !== nodoSeleccionado.titulo && (
                    <Text fontSize="sm" color="fg.muted">
                      {nodoSeleccionado.detalle.descripcion}
                    </Text>
                  )}
              </Stack>

              <HStack gap="2">
                <Badge
                  colorPalette={COLOR_ESTADO[nodoSeleccionado.estado].palette}
                  variant="subtle"
                  size="md"
                >
                  {COLOR_ESTADO[nodoSeleccionado.estado].label}
                </Badge>
                {nodoSeleccionado.tiene_desvio && (
                  <Badge colorPalette="orange" variant="solid" size="md">
                    <LuTriangleAlert size={14} style={{ display: "inline", marginRight: "4px" }} />
                    Con desvío
                  </Badge>
                )}
              </HStack>
            </HStack>

            {/* Metadatos (operario, fecha) */}
            <HStack gap="6" wrap="wrap" fontSize="sm" color="fg.muted" pt="1" borderTopWidth="1px" borderColor="border.subtle">
              {nodoSeleccionado.detalle.operario_nombre && (
                <HStack gap="1.5">
                  <LuUser size={15} />
                  <Text>
                    Operario:{" "}
                    <Text as="span" fontWeight="semibold" color="fg">
                      {nodoSeleccionado.detalle.operario_nombre}
                    </Text>
                  </Text>
                </HStack>
              )}
              {nodoSeleccionado.fecha_hora ? (
                <HStack gap="1.5">
                  <LuClock size={15} />
                  <Text>
                    Fecha y hora:{" "}
                    <Text as="span" fontWeight="semibold" color="fg">
                      {formatoFechaHora(nodoSeleccionado.fecha_hora)}
                    </Text>
                  </Text>
                </HStack>
              ) : (
                <HStack gap="1.5">
                  <LuClock size={15} />
                  <Text color="fg.subtle">Sin fecha de ejecución (pendiente)</Text>
                </HStack>
              )}
            </HStack>

            {/* Rendimiento (para inicio y cierre) */}
            {nodoSeleccionado.detalle.rendimiento && (
              <SimpleGrid columns={{ base: 1, sm: 3 }} gap="4" p="4" bg="bg.muted" rounded="md">
                <Box>
                  <Text fontSize="xs" color="fg.muted">
                    Cantidad objetivo
                  </Text>
                  <Text fontSize="base" fontWeight="bold" color="fg">
                    {cantidadConUnidad(nodoSeleccionado.detalle.rendimiento.cantidad_objetivo, unidad)}
                  </Text>
                </Box>
                {nodoSeleccionado.detalle.rendimiento.cantidad_producida !== null && (
                  <Box>
                    <Text fontSize="xs" color="fg.muted">
                      Cantidad producida
                    </Text>
                    <Text fontSize="base" fontWeight="bold" color="fg">
                      {cantidadConUnidad(nodoSeleccionado.detalle.rendimiento.cantidad_producida, unidad)}
                    </Text>
                  </Box>
                )}
                {nodoSeleccionado.detalle.rendimiento.porcentaje_rendimiento !== null && (
                  <Box>
                    <Text fontSize="xs" color="fg.muted">
                      Rendimiento obtenido
                    </Text>
                    <Badge colorPalette="teal" variant="solid" size="md" mt="1">
                      {formatoPorcentajeFino(nodoSeleccionado.detalle.rendimiento.porcentaje_rendimiento)}
                    </Badge>
                  </Box>
                )}
              </SimpleGrid>
            )}

            {/* Ingredientes Consumidos */}
            {nodoSeleccionado.detalle.ingredientes_consumidos.length > 0 && (
              <Stack gap="2">
                <Heading as="h5" size="xs" color="fg.muted" textTransform="uppercase">
                  Ingredientes consumidos en esta etapa ({nodoSeleccionado.detalle.ingredientes_consumidos.length})
                </Heading>
                <Tarjeta overflowX="auto" p="0">
                  <Table.Root variant="outline" size="sm">
                    <Table.Header>
                      <FilaEncabezado>
                        <EncabezadoOscuro>Ingrediente</EncabezadoOscuro>
                        <EncabezadoOscuro numero ancho="media">Cantidad</EncabezadoOscuro>
                        <EncabezadoOscuro ancho="media">Lote ingrediente</EncabezadoOscuro>
                        <EncabezadoOscuro>Proveedor</EncabezadoOscuro>
                      </FilaEncabezado>
                    </Table.Header>
                    <Table.Body>
                      {nodoSeleccionado.detalle.ingredientes_consumidos.map((ins, i) => (
                        <Table.Row key={i}>
                          <Celda p="2.5">{ins.ingrediente_nombre}</Celda>
                          <Celda p="2.5" numero>
                            {cantidadConUnidad(ins.cantidad, ins.unidad_medida)}
                          </Celda>
                          <Celda p="2.5">{ins.lote_insumo_codigo || "—"}</Celda>
                          <Celda p="2.5">{ins.proveedor_nombre || "—"}</Celda>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Tarjeta>
              </Stack>
            )}

            {/* Desperdicios / Desvíos */}
            {nodoSeleccionado.detalle.desperdicios.length > 0 && (
              <Box
                p="4"
                rounded="md"
                bg="orange.subtle"
                borderWidth="1px"
                borderColor="orange.muted"
              >
                <HStack gap="2" color="orange.fg" mb="2">
                  <LuTriangleAlert size={16} />
                  <Heading as="h5" size="xs" textTransform="uppercase">
                    Desvíos de material / Desperdicios registrados ({nodoSeleccionado.detalle.desperdicios.length})
                  </Heading>
                </HStack>
                <Stack gap="2">
                  {nodoSeleccionado.detalle.desperdicios.map((desp, i) => (
                    <HStack
                      key={i}
                      justify="space-between"
                      fontSize="sm"
                      p="2"
                      bg="bg.panel"
                      rounded="sm"
                      borderWidth="1px"
                      borderColor="border.subtle"
                    >
                      <Text fontWeight="semibold" color="fg">
                        Cantidad: {cantidadConUnidad(desp.cantidad, desp.unidad_medida)}
                      </Text>
                      <Text color="fg.muted">
                        Motivo: <Text as="span" color="fg">{desp.motivo || "Sin motivo indicado"}</Text>
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Tarjeta>
      )}
    </Stack>
  );
}

function VStack(props: React.ComponentProps<typeof Stack>) {
  return <Stack direction="column" {...props} />;
}
