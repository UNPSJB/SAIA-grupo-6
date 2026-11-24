import { avisarExito } from "../../../../components/ui/patrones";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Badge,
  Box,
  Flex,
  HStack,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import {
  formatoFecha,
  formatoFechaHora,
} from "../../../../common/utils/fechas";
import {
  BannerError,
  BotonCancelar,
  BotonGuardar,
  BotonTexto,
  Celda,
  EncabezadoOscuro,
  EstadoCargando,
  EtiquetaEstado,
  FilaEncabezado,
  Tarjeta,
  TextoTruncado,
} from "../../../../components/ui/patrones";
import {
  DatoDetalle,
  GrillaDatos,
  PaginaDetalle,
  SeccionDetalle,
} from "../../../../components/ui/plantillas";
import { useAuth } from "../../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../../common/api/permissions";
import {
  obtenerRetiro,
  cerrarRetiro,
} from "../../services/retiroService";
import type { RetiroAfectadoResumen, RetiroDetalle } from "../../types/retiro";
import { ModalNotificarAfectado } from "../ModalNotificarAfectado";
import { ModalCerrarRetiro } from "../ModalCerrarRetiro";
import { etiquetaOrigenRetiro, etiquetaMotivoRetiro } from "../../types/retiro";
import { BotonAccion } from "../../../../components/ui/patrones";

const TONO_ESTADO_RETIRO: Record<string, "ok" | "alerta" | "peligro" | "info" | "neutro"> = {
  EN_CURSO: "alerta",
  CERRADO: "ok",
};

export function RetiroDetallePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const esAdmin = puedeAdministrar(user);
  const puedeOp = puedeOperar(user);
  const { id } = useParams<{ id: string }>();
  const retiroId = Number(id);
  const idValido = Number.isFinite(retiroId) ? retiroId : null;

  const [retiro, setRetiro] = useState<RetiroDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [modalNotificar, setModalNotificar] = useState<{
    open: boolean;
    afectado: RetiroAfectadoResumen;
  } | null>(null);
  const [modalCerrar, setModalCerrar] = useState(false);

  const cargar = useCallback(async () => {
    if (!idValido) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerRetiro(idValido);
      setRetiro(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo obtener el retiro.");
    } finally {
      setLoading(false);
    }
  }, [idValido]);

  // Mismo `setTimeout(..., 0)` que `useLista` y `useRegistro`: evita setear
  // estado de forma síncrona dentro del efecto.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargar]);

  const recargar = async () => {
    await cargar();
  };

  const cerrado = retiro?.estado === "CERRADO";
  const totalAfectados = retiro?.afectados.length ?? 0;
  const notificados = retiro?.afectados.filter(
    (a: RetiroAfectadoResumen) => a.estado_notificacion === "NOTIFICADO"
  ).length ?? 0;
  const tienePendientes = notificados < totalAfectados;
  const totalPendientes = totalAfectados - notificados;

  const handleNotificar = (afectado: RetiroAfectadoResumen) => {
    setModalNotificar({ open: true, afectado });
  };

  const handleCerrar = async (accionCorrectiva: string) => {
    setProcesando(true);
    try {
      await cerrarRetiro(retiroId, { accion_correctiva: accionCorrectiva });
      avisarExito("Retiro cerrado correctamente.");
      setModalCerrar(false);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el retiro.");
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <PaginaDetalle volver={{ a: "/incidentes?tab=retiros", etiqueta: "Retiros" }} titulo="Retiro">
        <EstadoCargando>Cargando retiro...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !retiro) {
    return (
      <PaginaDetalle volver={{ a: "/incidentes?tab=retiros", etiqueta: "Retiros" }} titulo="Retiro">
        <BannerError>{error || "No se encontró el retiro"}</BannerError>
      </PaginaDetalle>
    );
  }

  const estadoTono = TONO_ESTADO_RETIRO[retiro.estado] ?? "neutro";

  return (
    <>
      <PaginaDetalle
        volver={{ a: "/incidentes?tab=retiros", etiqueta: "Retiros" }}
        titulo={`Retiro #${retiro.id}`}
        descripcion={`Lote ${retiro.lote_codigo} · ${retiro.lote_producto_nombre}`}
        estado={
          <EtiquetaEstado tono={estadoTono}>
            {retiro.estado === "CERRADO" ? "Cerrado" : "En curso"}
          </EtiquetaEstado>
        }
        acciones={
          <>
            {!cerrado && esAdmin && (
              <BotonGuardar
                loading={procesando}
                disabled={procesando || tienePendientes}
                onClick={() => setModalCerrar(true)}
                title={
                  tienePendientes
                    ? `No se puede cerrar: quedan ${totalPendientes} afectado(s) pendiente(s) de notificación.`
                    : undefined
                }
              >
                Cerrar retiro
              </BotonGuardar>
            )}
            <BotonCancelar
              onClick={() => navigate("/incidentes?tab=retiros")}
              disabled={procesando}
            >
              Volver a la lista
            </BotonCancelar>
          </>
        }
      >
        {error && <BannerError>{error}</BannerError>}

        {/* Banner superior: estado del retiro */}
        <Alert.Root
          status={cerrado ? "info" : "error"}
          mb="6"
          alignItems="flex-start"
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {cerrado
                ? "Retiro cerrado del mercado"
                : "Retiro activo del mercado"}
            </Alert.Title>
            <Alert.Description>
              {cerrado
                ? `El lote ${retiro.lote_codigo} está retirado del mercado. Resolución: ${retiro.accion_correctiva ?? "Sin detalle registrado."}`
                : `El lote ${retiro.lote_codigo} está retirado del mercado. No se pueden hacer nuevas reservas ni despachos sobre él.`}
            </Alert.Description>
            {retiro.incidente_id && (
              <HStack gap="3" flexWrap="wrap" mt="3">
                <BotonTexto
                  onClick={() => navigate(`/incidentes/${retiro.incidente_id}`)}
                  title="Ver el incidente asociado"
                >
                  Ver incidente #{retiro.incidente_id}
                </BotonTexto>
              </HStack>
            )}
          </Alert.Content>
        </Alert.Root>

        {/* Resumen y afectados a todo el ancho, uno debajo del otro: con
            pocos afectados, la tabla al lado del resumen dejaba media columna
            vacía. */}
        <Stack gap="6">
          <SeccionDetalle titulo="Resumen del retiro">
            <GrillaDatos>
              <DatoDetalle etiqueta="Lote">
                <BotonTexto
                  onClick={() => navigate(`/lotes/${retiro.lote_id}`)}
                  title="Ver ficha del lote"
                >
                  {retiro.lote_codigo}
                </BotonTexto>
              </DatoDetalle>
              <DatoDetalle etiqueta="Producto">{retiro.lote_producto_nombre}</DatoDetalle>
              <DatoDetalle etiqueta="Motivo">{etiquetaMotivoRetiro(retiro.motivo)}</DatoDetalle>
              <DatoDetalle etiqueta="Origen">{etiquetaOrigenRetiro(retiro.origen)}</DatoDetalle>
              <DatoDetalle etiqueta="Fecha de retiro">
                {formatoFecha(retiro.fecha_retiro)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Responsable">
                {retiro.iniciado_por_nombre}
              </DatoDetalle>
              <DatoDetalle etiqueta="Fecha de registro">
                {formatoFechaHora(retiro.fecha_registro)}
              </DatoDetalle>
              <DatoDetalle etiqueta="Notificaciones">
                {notificados} de {totalAfectados}
              </DatoDetalle>
              <DatoDetalle etiqueta="Saldo en planta">{retiro.saldo_en_planta}</DatoDetalle>
              <DatoDetalle etiqueta="En revisión">{retiro.en_revision}</DatoDetalle>
              {cerrado && (
                <>
                  <DatoDetalle etiqueta="Acción correctiva">
                    {retiro.accion_correctiva ?? "Sin detalle registrado."}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Fecha de cierre">
                    {formatoFechaHora(retiro.fecha_cierre)}
                  </DatoDetalle>
                  <DatoDetalle etiqueta="Cerrado por">
                    {retiro.cerrado_por ?? "-"}
                  </DatoDetalle>
                </>
              )}
              {retiro.reclamo_id && (
                <DatoDetalle etiqueta="Reclamo de origen">
                  <BotonTexto
                    onClick={() => navigate(`/reclamos/${retiro.reclamo_id}`)}
                    title="Ver la ficha del reclamo"
                  >
                    Reclamo #{retiro.reclamo_id}
                  </BotonTexto>
                </DatoDetalle>
              )}
              {retiro.detalle?.trim() && (
                <Box gridColumn="1 / -1">
                  <DatoDetalle etiqueta="Detalle">{retiro.detalle}</DatoDetalle>
                </Box>
              )}
            </GrillaDatos>
          </SeccionDetalle>

          {/* Tabla de afectados */}
          <SeccionDetalle titulo="Clientes afectados">
            {retiro.afectados.length === 0 ? (
              <Text color="fg.muted" fontSize="sm">
                No había entregas ni despachos registrados para este lote al
                momento del retiro, por lo que no hay clientes a notificar.
              </Text>
            ) : (
              <Tarjeta overflowX="auto">
                <Table.Root variant="outline" w="100%" minW="760px">
                  <Table.Header>
                    <FilaEncabezado>
                      <EncabezadoOscuro ancho="amplia">Cliente</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="media">Cantidad</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="amplia">Transportista</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="angosta">Estado entrega</EncabezadoOscuro>
                      <EncabezadoOscuro ancho="media">Notificación</EncabezadoOscuro>
                      <EncabezadoOscuro center ancho="acciones">Acciones</EncabezadoOscuro>
                    </FilaEncabezado>
                  </Table.Header>
                  <Table.Body>
                    {retiro.afectados.map((afectado: RetiroAfectadoResumen) => (
                      <Table.Row key={afectado.id}>
                        <Celda>
                          <Text fontSize="sm" fontWeight="medium" color="fg">
                            {afectado.cliente_nombre}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {afectado.cliente_telefono ?? "Sin teléfono"}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {afectado.cliente_email ?? "Sin email"}
                          </Text>
                        </Celda>
                        <Celda whiteSpace="nowrap">
                          {afectado.cantidad_con_unidad}
                        </Celda>
                        <Celda pe="6">
                          <TextoTruncado
                            texto={afectado.transportista}
                            max={36}
                          />
                        </Celda>
                        <Celda whiteSpace="nowrap">
                          <BadgeEstadoSalida estado={afectado.estado_salida} />
                        </Celda>
                        <Celda whiteSpace="nowrap">
                          <EstadoNotificacion
                            estado={afectado.estado_notificacion}
                            fecha={afectado.fecha_notificacion}
                            medio={afectado.medio_contacto}
                          />
                        </Celda>
                        <Celda center>
                          <Flex justify="center" gap="2" flexWrap="wrap">
                            {!cerrado &&
                              puedeOp &&
                              afectado.estado_notificacion === "PENDIENTE" && (
                                <BotonAccion
                                  accion="notificar"
                                  label="Marcar como notificado"
                                  tooltip="Marcar como notificado"
                                  onClick={() => handleNotificar(afectado)}
                                />
                              )}
                          </Flex>
                        </Celda>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Tarjeta>
            )}
          </SeccionDetalle>
        </Stack>
      </PaginaDetalle>

      <ModalNotificarAfectado
        isOpen={!!modalNotificar}
        retiroId={retiroId}
        afectadoId={modalNotificar?.afectado.id ?? 0}
        afectado={modalNotificar?.afectado ?? null}
        fechaRetiro={retiro.fecha_retiro}
        onClose={() => setModalNotificar(null)}
        onNotificado={recargar}
      />

      <ModalCerrarRetiro
        isOpen={modalCerrar}
        retiroId={retiroId}
        loteCodigo={retiro.lote_codigo}
        loteProducto={retiro.lote_producto_nombre}
        motivo={retiro.motivo}
        totalAfectados={totalAfectados}
        notificados={notificados}
        incidenteId={retiro.incidente_id}
        tienePendientes={tienePendientes}
        totalPendientes={totalPendientes}
        onClose={() => setModalCerrar(false)}
        onCerrado={handleCerrar}
        disabled={!esAdmin || cerrado || tienePendientes}
      />
    </>
  );
}

/** Badge del estado de la salida (entrega). */
function BadgeEstadoSalida({ estado }: { estado: string }) {
  const tono: Record<string, "ok" | "alerta" | "peligro" | "info" | "neutro"> = {
    DESPACHADO: "alerta",
    ENTREGADO: "ok",
    RECHAZADA: "peligro",
    CANCELADO: "neutro",
    RESERVADO: "info",
  };
  const paleta = tono[estado] ?? "neutro";
  return (
    <Badge
      colorPalette={paleta}
      variant="subtle"
      size="xs"
      whiteSpace="nowrap"
    >
      {estado === "DESPACHADO"
        ? "En tránsito"
        : estado.charAt(0) + estado.slice(1).toLowerCase()}
    </Badge>
  );
}

/** Estado de notificación del afectado. */
function EstadoNotificacion({
  estado,
  fecha,
  medio,
}: {
  estado: string;
  fecha: string | null;
  medio: string | null;
}) {
  const notificado = estado === "NOTIFICADO";
  return (
    <Box>
      <Badge
        colorPalette={notificado ? "green" : "orange"}
        variant="subtle"
        size="xs"
        whiteSpace="nowrap"
      >
        {notificado ? "Notificado" : "Pendiente"}
      </Badge>
      {notificado && fecha && medio && (
        <Text fontSize="xs" color="fg.muted" mt="1">
          {formatoFecha(fecha)} · {medio}
        </Text>
      )}
    </Box>
  );
}
