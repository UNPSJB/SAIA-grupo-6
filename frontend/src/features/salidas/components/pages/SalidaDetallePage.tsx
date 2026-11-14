import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Button,
  HStack,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuEye } from "react-icons/lu";
import { formatoFecha, formatoFechaHora, hoyISO } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { useAuth } from "../../../../common/context/useAuth";
import {
  puedeAdministrar,
  puedeOperar,
} from "../../../../common/api/permissions";
import {
  BannerError,
  BotonTexto,
  EstadoCargando,
  EtiquetaEstado,
  type TonoEstado,
} from "../../../../components/ui/patrones";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { MiniaturaFoto } from "../../../incidente/components/MiniaturaFoto";
import { obtenerSalida } from "../../services/salidaService";
import {
  etiquetaMotivoRechazo,
  type Salida,
} from "../../types/salida";
import { ModalDespacharSalida } from "../ModalDespacharSalida";
import { ModalEntregarSalida } from "../ModalEntregarSalida";
import { ModalCancelarSalida } from "../ModalCancelarSalida";
import { ModalRechazarSalida } from "../ModalRechazarSalida";
import { ModalResolverRechazo } from "../ModalResolverRechazo";
import { ModalNuevoReclamo } from "../../../reclamos/components/ModalNuevoReclamo";
import { notificarCambioIncidentes } from "../../../incidente/eventoIncidentes";

const TONO_ESTADO: Record<string, TonoEstado> = {
  RESERVADO: "info",
  DESPACHADO: "ok",
  ENTREGADO: "ok",
  CANCELADO: "peligro",
  RECHAZADA: "peligro",
};

/**
 * Página de detalle de una salida de producto.
 *
 * Muestra la información de la reserva, los datos del lote de origen,
 * el seguimiento del circuito logístico y la información de auditoría.
 */
export function SalidaDetallePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeRegistrarRechazo = puedeOperar(user);
  const puedeResolverRechazo = puedeAdministrar(user);
  const { id } = useParams<{ id: string }>();
  const salidaId = Number(id);

  const idValido = Number.isFinite(salidaId) ? salidaId : null;

  const [salida, setSalida] = useState<Salida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales de acciones
  const [modalDespachar, setModalDespachar] = useState(false);
  const [modalEntregar, setModalEntregar] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [modalRechazar, setModalRechazar] = useState(false);
  const [modalResolver, setModalResolver] = useState(false);
  const [modalReclamo, setModalReclamo] = useState(false);

  const recargarSalida = async () => {
    if (!idValido) return;
    const actualizada = await obtenerSalida(idValido);
    setSalida(actualizada);
  };

  useEffect(() => {
    if (!idValido) {
      setError("ID de salida inválido.");
      setLoading(false);
      return;
    }

    let vigente = true;
    obtenerSalida(idValido)
      .then((s) => {
        if (vigente) {
          setSalida(s);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (vigente) {
          setError(
            err instanceof Error ? err.message : "No se pudo obtener la salida."
          );
          setLoading(false);
        }
      });

    return () => {
      vigente = false;
    };
  }, [idValido]);

  if (loading) {
    return (
      <PaginaDetalle
        volver={{ a: "/salidas", etiqueta: "Salidas" }}
        titulo="Salida de producto"
      >
        <EstadoCargando>Cargando salida...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !salida) {
    return (
      <PaginaDetalle
        volver={{ a: "/salidas", etiqueta: "Salidas" }}
        titulo="Salida de producto"
      >
        <BannerError>{error || "No se encontró la salida"}</BannerError>
      </PaginaDetalle>
    );
  }

  const puedeDespachar = salida.estado === "RESERVADO";
  const puedeEntregar = salida.estado === "DESPACHADO";
  const puedeCancelar = salida.estado === "RESERVADO";
  const rechazoPendiente =
    salida.estado === "RECHAZADA" && salida.disposicion === null;
  const puedeRechazar = salida.estado === "DESPACHADO" && puedeRegistrarRechazo;
  const puedeResolver = rechazoPendiente && puedeResolverRechazo;
  const puedeReclamar = salida.estado === "ENTREGADO" && puedeRegistrarRechazo;
  const loteVencido =
    !!salida.fecha_vencimiento && salida.fecha_vencimiento < hoyISO();

  const esRetiraCliente = salida.forma_entrega === "RETIRA_CLIENTE";

  const etiquetaSeguimiento =
    salida.estado === "ENTREGADO" ||
    salida.estado === "CANCELADO" ||
    salida.estado === "RECHAZADA"
      ? "Estado final"
      : "Próximo paso";

  const tituloPagina: string =
    salida.estado === "RESERVADO"
      ? `Reserva de ${cantidadConUnidad(salida.cantidad, salida.unidad_medida)} de ${salida.producto_nombre} para ${salida.cliente_nombre}`
      : salida.estado === "DESPACHADO"
      ? `Despacho a ${salida.cliente_nombre}`
      : salida.estado === "ENTREGADO"
      ? `Entrega a ${salida.cliente_nombre}`
      : salida.estado === "RECHAZADA"
      ? `Entrega rechazada de ${salida.producto_nombre} por ${salida.cliente_nombre}`
      : `Reserva cancelada de ${salida.cliente_nombre}`;

  const textoSeguimiento: string = (() => {
    switch (salida.estado) {
      case "RESERVADO":
        return "Despachar la reserva o cancelarla.";
      case "DESPACHADO":
        if (esRetiraCliente) {
          return "El cliente retira en planta. Pendiente confirmar el retiro o registrar un rechazo.";
        }
        return `En camino con ${salida.transportista_nombre}. Pendiente registrar la entrega o un rechazo.`;
      case "ENTREGADO": {
        const momento = salida.entregado_en
          ? formatoFechaHora(salida.entregado_en)
          : salida.fecha_entrega
          ? formatoFecha(salida.fecha_entrega)
          : null;
        if (esRetiraCliente) {
          return momento
            ? `Entrega finalizada: el cliente retiró el producto de la planta el ${momento}.`
            : "Entrega finalizada: el cliente retiró el producto de la planta.";
        }
        return momento
          ? `Entrega finalizada: el transportista entregó el producto el ${momento}.`
          : "Entrega finalizada: el transportista entregó el producto.";
      }
      case "RECHAZADA":
        if (salida.disposicion === null) {
          return "El cliente rechazó la entrega. La mercadería está en revisión: un administrador debe decidir si se reingresa al lote o se desecha.";
        }
        return salida.disposicion === "REINGRESADA"
          ? "Rechazo resuelto: la mercadería se reingresó al lote y volvió al saldo disponible."
          : "Rechazo resuelto: la mercadería se desechó y no vuelve al saldo del lote.";
      case "CANCELADO":
        return salida.motivo_cancelacion
          ? `Cancelado: ${salida.motivo_cancelacion}.`
          : "Cancelado.";
      default:
        return "";
    }
  })();

  return (
    <PaginaDetalle
      volver={{ a: "/salidas", etiqueta: "Salidas" }}
      titulo={tituloPagina}
      estado={
        <EtiquetaEstado
          tono={TONO_ESTADO[salida.estado] ?? "neutro"}
        >
          {salida.estado}
        </EtiquetaEstado>
      }
      descripcion={`Reserva de ${cantidadConUnidad(
        salida.cantidad,
        salida.unidad_medida
      )} para ${salida.cliente_nombre}`}
      acciones={
        <HStack gap="2" flexWrap="wrap">
          {puedeDespachar && (
            <Button
              variant="solid"
              colorPalette="brand"
              size="sm"
              onClick={() => setModalDespachar(true)}
            >
              Despachar
            </Button>
          )}
          {puedeCancelar && (
            <Button
              variant="outline"
              colorPalette="red"
              size="sm"
              onClick={() => setModalCancelar(true)}
            >
              Cancelar
            </Button>
          )}
          {puedeEntregar && (
            <Button
              variant="solid"
              colorPalette="green"
              size="sm"
              onClick={() => setModalEntregar(true)}
            >
              {esRetiraCliente ? "Confirmar retiro del cliente" : "Registrar entrega"}
            </Button>
          )}
          {puedeRechazar && (
            <Button
              variant="outline"
              colorPalette="orange"
              size="sm"
              onClick={() => setModalRechazar(true)}
            >
              {esRetiraCliente ? "Rechazar retiro" : "Rechazar entrega"}
            </Button>
          )}
          {puedeReclamar && (
            <Button
              variant="outline"
              colorPalette="blue"
              size="sm"
              onClick={() => setModalReclamo(true)}
            >
              Registrar reclamo
            </Button>
          )}
          {puedeResolver && (
            <Button
              variant="solid"
              colorPalette="blue"
              size="sm"
              onClick={() => setModalResolver(true)}
            >
              Resolver rechazo
            </Button>
          )}
        </HStack>
      }
    >
      <Stack gap="6">

        {/* Tarjeta 1: Información de la Reserva */}
        <SeccionDetalle titulo="Información de la Reserva">
          <SimpleGrid columns={{ base: 1, md: 3, lg: 5 }} gap="6">
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Cliente
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {salida.cliente_nombre}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Cantidad reservada
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {cantidadConUnidad(salida.cantidad, salida.unidad_medida)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Fecha de reserva
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {formatoFecha(salida.fecha_reserva)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Estado actual
              </Text>
              <EtiquetaEstado
                tono={TONO_ESTADO[salida.estado] ?? "neutro"}
              >
                {salida.estado}
              </EtiquetaEstado>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Registrado por
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {salida.creado_por_nombre ?? "—"}
              </Text>
            </Box>
            {salida.forma_entrega && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Forma de entrega
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.forma_entrega === "CON_TRANSPORTISTA"
                    ? "Con transportista"
                    : "Retira el cliente en planta"}
                </Text>
              </Box>
            )}
            {salida.transportista_nombre && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Transportista
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.transportista_nombre}
                </Text>
              </Box>
            )}
            {salida.fecha_despacho && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Fecha de despacho
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.despachado_en
                    ? formatoFechaHora(salida.despachado_en)
                    : formatoFecha(salida.fecha_despacho)}
                </Text>
              </Box>
            )}
            {salida.fecha_entrega && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Fecha de entrega
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.entregado_en
                    ? formatoFechaHora(salida.entregado_en)
                    : formatoFecha(salida.fecha_entrega)}
                </Text>
              </Box>
            )}
            {salida.recibido_por && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  {esRetiraCliente ? "Retirado por" : "Recibido por"}
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.recibido_por}
                </Text>
              </Box>
            )}
            {salida.observacion_entrega && (
              <Box gridColumn="1 / -1">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Observación de entrega
                </Text>
                <Text fontSize="sm" color="fg" whiteSpace="pre-line">
                  {salida.observacion_entrega}
                </Text>
              </Box>
            )}
            {salida.motivo_cancelacion && (
              <Box gridColumn="1 / -1">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Motivo de cancelación
                </Text>
                <Text fontSize="sm" color="fg" whiteSpace="pre-line">
                  {salida.motivo_cancelacion}
                </Text>
                {salida.cancelada_por_nombre && (
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Cancelado por {salida.cancelada_por_nombre}
                  </Text>
                )}
                {salida.fecha_cancelacion && (
                  <Text fontSize="xs" color="fg.muted">
                    {formatoFechaHora(salida.fecha_cancelacion)}
                  </Text>
                )}
              </Box>
            )}
          </SimpleGrid>
        </SeccionDetalle>

        {/* Tarjeta 2: Rechazo y disposición (solo si hubo rechazo) */}
        {(salida.estado === "RECHAZADA" || salida.motivo_rechazo) && (
          <SeccionDetalle titulo="Rechazo y destino de la mercadería">
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="6">
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Motivo del rechazo
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.motivo_rechazo_label ??
                    etiquetaMotivoRechazo(salida.motivo_rechazo)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Fecha del rechazo
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {formatoFecha(salida.fecha_rechazo)}
                </Text>
              </Box>
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Registrado por
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {salida.rechazada_por_nombre ?? "—"}
                </Text>
              </Box>
              {salida.detalle_rechazo && (
                <Box gridColumn="1 / -1">
                  <Text fontSize="xs" color="fg.muted" mb="1">
                    Detalle del rechazo
                  </Text>
                  <Text fontSize="sm" color="fg" whiteSpace="pre-line">
                    {salida.detalle_rechazo}
                  </Text>
                </Box>
              )}

              <Box gridColumn="1 / -1">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Incidente asociado
                </Text>
                {salida.incidente_id ? (
                  <Stack gap="3">
                    <HStack gap="3" flexWrap="wrap">
                      <Text fontSize="sm" fontWeight="medium" color="fg">
                        Incidente #{salida.incidente_id}
                      </Text>
                      {salida.incidente_estado && (
                        <EtiquetaEstado
                          tono={
                            salida.incidente_estado === "abierto"
                              ? "alerta"
                              : "ok"
                          }
                        >
                          {salida.incidente_estado === "abierto"
                            ? "Abierto"
                            : "Cerrado"}
                        </EtiquetaEstado>
                      )}
                      <BotonTexto
                        onClick={() =>
                          navigate(`/incidentes/${salida.incidente_id}`)
                        }
                        title="Ver el incidente completo"
                      >
                        <LuEye size={16} aria-hidden /> Ver incidente
                      </BotonTexto>
                    </HStack>
                    {salida.incidente_foto_url && (
                      <MiniaturaFoto rutaFoto={salida.incidente_foto_url} />
                    )}
                  </Stack>
                ) : (
                  <Text fontSize="sm" color="fg.muted">
                    —
                  </Text>
                )}
              </Box>

              <Box gridColumn="1 / -1">
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Decisión sobre la mercadería
                </Text>
                {salida.disposicion ? (
                  <Stack gap="2">
                    <EtiquetaEstado
                      tono={
                        salida.disposicion === "REINGRESADA" ? "ok" : "peligro"
                      }
                    >
                      {salida.disposicion === "REINGRESADA"
                        ? "Reingresada al lote"
                        : "Desechada"}
                    </EtiquetaEstado>
                    {salida.justificacion_disposicion && (
                      <Text fontSize="sm" color="fg" whiteSpace="pre-line">
                        {salida.justificacion_disposicion}
                      </Text>
                    )}
                    <HStack gap="4" flexWrap="wrap">
                      {salida.decidida_por_nombre && (
                        <Text fontSize="xs" color="fg.muted">
                          Decidido por {salida.decidida_por_nombre}
                        </Text>
                      )}
                      {salida.fecha_disposicion && (
                        <Text fontSize="xs" color="fg.muted">
                          {formatoFechaHora(salida.fecha_disposicion)}
                        </Text>
                      )}
                    </HStack>
                  </Stack>
                ) : (
                  <Alert.Root status="warning">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Decisión pendiente</Alert.Title>
                      <Alert.Description>
                        La mercadería está retenida en revisión hasta que un
                        administrador decida si se reingresa al lote o se desecha.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                )}
              </Box>
            </SimpleGrid>
          </SeccionDetalle>
        )}

        {/* Tarjeta 3: Datos del Lote de Origen */}
        <SeccionDetalle titulo="Datos del Lote de Origen">
          <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} gap="6">
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Código del lote
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg" fontFamily="mono">
                {salida.lote_numero}
              </Text>
            </Box>
            <Box gridColumn="1 / -1">
              <Text fontSize="xs" color="fg.muted" mb="1">
                Producto
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {salida.producto_nombre}
              </Text>
              <Text fontSize="xs" color="fg.muted" mt="1">
                Unidad de medida: {salida.unidad_medida}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Fecha de elaboración
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {formatoFecha(salida.fecha_elaboracion)}
              </Text>
            </Box>
            <Box gridColumn="1 / -1">
              <BotonTexto
                onClick={() => navigate(`/lotes/${salida.lote_id}`)}
                title="Ver ficha completa del lote original"
              >
                <LuEye size={16} aria-hidden />{" "}
                Ver ficha completa del lote original
              </BotonTexto>
            </Box>
          </SimpleGrid>
        </SeccionDetalle>

        {/* Tarjeta 4: Seguimiento y Próximos pasos */}
        <SeccionDetalle titulo="Seguimiento y Próximos pasos">
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap="6">
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Transportista asignado
              </Text>
              {salida.transportista_nombre ? (
                <>
                  <Text fontSize="sm" fontWeight="medium" color="fg">
                    {salida.transportista_nombre}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Asignado al despachar
                  </Text>
                </>
              ) : (
                <>
                  <Text fontSize="sm" color="fg.muted">
                    —
                  </Text>
                  <Text fontSize="xs" color="fg.subtle" mt="2">
                    Se asignará al despachar la reserva.
                  </Text>
                </>
              )}
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Fecha de despacho
              </Text>
              {salida.fecha_despacho ? (
                <>
                  <Text fontSize="sm" fontWeight="medium" color="fg">
                    {salida.despachado_en
                      ? formatoFechaHora(salida.despachado_en)
                      : formatoFecha(salida.fecha_despacho)}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Completado
                  </Text>
                </>
              ) : (
                <>
                  <Text fontSize="sm" color="fg.muted">
                    —
                  </Text>
                  <Text fontSize="xs" color="fg.subtle" mt="2">
                    Pendiente: despachar la reserva.
                  </Text>
                </>
              )}
            </Box>
            <Box gridColumn="1 / -1">
              <Text fontSize="xs" color="fg.muted" mb="1">
                {etiquetaSeguimiento}
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg" whiteSpace="pre-line">
                {textoSeguimiento}
              </Text>
            </Box>
          </SimpleGrid>
        </SeccionDetalle>

        {/* Reclamos de cliente sobre esta entrega (Historia 20) */}
        {salida.estado === "ENTREGADO" && (
          <SeccionDetalle titulo="Reclamos de esta entrega">
            {salida.reclamos.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                Esta entrega no tiene reclamos registrados.
              </Text>
            ) : (
              <Stack gap="3">
                {salida.reclamos.map((reclamo) => (
                  <HStack
                    key={reclamo.id}
                    justify="space-between"
                    align="flex-start"
                    gap="4"
                    flexWrap="wrap"
                    p="3"
                    bg="bg.subtle"
                    rounded="md"
                    borderWidth="1px"
                    borderColor="border.subtle"
                  >
                    <Box>
                      <BotonTexto
                        onClick={() => navigate(`/reclamos/${reclamo.id}`)}
                        title="Ver el detalle del reclamo"
                      >
                        Reclamo del {formatoFecha(reclamo.fecha_reclamo)}
                      </BotonTexto>
                      <Text fontSize="xs" color="fg.muted" mt="1">
                        Motivo: {reclamo.motivo_label ?? reclamo.motivo}
                      </Text>
                    </Box>
                    <HStack gap="2" flexWrap="wrap">
                      <Badge
                        colorPalette={
                          reclamo.fuera_de_plazo ? "orange" : "green"
                        }
                        variant="subtle"
                      >
                        {reclamo.fuera_de_plazo
                          ? "Fuera de plazo"
                          : "En plazo"}
                      </Badge>
                      <EtiquetaEstado
                        tono={
                          reclamo.incidente_estado === "cerrado" ? "ok" : "alerta"
                        }
                      >
                        {reclamo.incidente_estado === "cerrado"
                          ? "Cerrado"
                          : "Abierto"}
                      </EtiquetaEstado>
                    </HStack>
                  </HStack>
                ))}
              </Stack>
            )}
          </SeccionDetalle>
        )}

        {/* Tarjeta 5: Información del sistema / Auditoría */}
        <SeccionDetalle titulo="Información del sistema">
          <SimpleGrid columns={{ base: 1, md: 3, lg: 3 }} gap="6">
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Fecha y hora de creación
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg">
                {salida.creado_en ? formatoFechaHora(salida.creado_en) : "—"}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                ID de salida
              </Text>
              <Text fontSize="sm" fontWeight="medium" color="fg" fontFamily="mono">
                #{salida.id}
              </Text>
            </Box>
            <Box>
              <Text fontSize="xs" color="fg.muted" mb="1">
                Estado del circuito
              </Text>
              <EtiquetaEstado
                tono={TONO_ESTADO[salida.estado] ?? "neutro"}
              >
                {salida.estado}
              </EtiquetaEstado>
            </Box>
            {salida.fecha_cancelacion && (
              <Box>
                <Text fontSize="xs" color="fg.muted" mb="1">
                  Fecha de cancelación
                </Text>
                <Text fontSize="sm" fontWeight="medium" color="fg">
                  {formatoFechaHora(salida.fecha_cancelacion)}
                </Text>
              </Box>
            )}
          </SimpleGrid>
        </SeccionDetalle>

      </Stack>

      <ModalDespacharSalida
        isOpen={modalDespachar}
        salidaId={salida.id}
        loteNumero={salida.lote_numero}
        productoNombre={salida.producto_nombre}
        clienteNombre={salida.cliente_nombre}
        clienteContacto={salida.cliente_contacto}
        clienteDomicilio={salida.cliente_domicilio}
        cantidad={salida.cantidad}
        unidadMedida={salida.unidad_medida}
        fechaReserva={salida.fecha_reserva}
        loteVencido={!!salida.fecha_vencimiento && salida.fecha_vencimiento < new Date().toISOString().split("T")[0]}
        onClose={() => setModalDespachar(false)}
        onDespachoRegistrado={() => {
          setModalDespachar(false);
          void obtenerSalida(salida.id).then((s) => setSalida(s));
        }}
      />

      <ModalEntregarSalida
        isOpen={modalEntregar}
        salidaId={salida.id}
        loteNumero={salida.lote_numero}
        productoNombre={salida.producto_nombre}
        clienteNombre={salida.cliente_nombre}
        cantidad={salida.cantidad}
        unidadMedida={salida.unidad_medida}
        formaEntrega={salida.forma_entrega ?? ""}
        fechaDespacho={salida.fecha_despacho ?? ""}
        despachadoEn={salida.despachado_en}
        onClose={() => setModalEntregar(false)}
        onEntregaRegistrada={() => {
          setModalEntregar(false);
          void obtenerSalida(salida.id).then((s) => setSalida(s));
        }}
      />

      <ModalCancelarSalida
        isOpen={modalCancelar}
        salidaId={salida.id}
        loteNumero={salida.lote_numero}
        productoNombre={salida.producto_nombre}
        clienteNombre={salida.cliente_nombre}
        cantidad={salida.cantidad}
        unidadMedida={salida.unidad_medida}
        onClose={() => setModalCancelar(false)}
        onCancelacionRegistrada={() => {
          setModalCancelar(false);
          void recargarSalida();
        }}
      />

      <ModalRechazarSalida
        isOpen={modalRechazar}
        salidaId={salida.id}
        loteNumero={salida.lote_numero}
        productoNombre={salida.producto_nombre}
        clienteNombre={salida.cliente_nombre}
        cantidad={salida.cantidad}
        unidadMedida={salida.unidad_medida}
        fechaDespacho={salida.fecha_despacho ?? ""}
        despachadoEn={salida.despachado_en}
        onClose={() => setModalRechazar(false)}
        onRechazoRegistrado={() => {
          setModalRechazar(false);
          void recargarSalida();
        }}
      />

      <ModalResolverRechazo
        isOpen={modalResolver}
        salidaId={salida.id}
        loteNumero={salida.lote_numero}
        productoNombre={salida.producto_nombre}
        clienteNombre={salida.cliente_nombre}
        cantidad={salida.cantidad}
        unidadMedida={salida.unidad_medida}
        motivoRechazoLabel={salida.motivo_rechazo_label}
        detalleRechazo={salida.detalle_rechazo}
        fechaRechazo={salida.fecha_rechazo}
        rechazadaPorNombre={salida.rechazada_por_nombre}
        incidenteFotoUrl={salida.incidente_foto_url}
        loteVencido={loteVencido}
        loteRetirado={salida.lote_retirado}
        onClose={() => setModalResolver(false)}
        onRechazoResuelto={() => {
          setModalResolver(false);
          void recargarSalida();
        }}
      />

      <ModalNuevoReclamo
        isOpen={modalReclamo}
        salidaInicial={salida}
        onClose={() => setModalReclamo(false)}
        onReclamoRegistrado={() => {
          setModalReclamo(false);
          void recargarSalida();
          notificarCambioIncidentes();
        }}
      />
    </PaginaDetalle>
  );
}
