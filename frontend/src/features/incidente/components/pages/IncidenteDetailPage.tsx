import { useCallback, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Box, Button, HStack, Image, Stack, Text, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuHistory, LuX } from "react-icons/lu";
import { useIncidente } from "../../hooks/useIncidente";
import { useHistorialIncidente } from "../../hooks/useHistorialIncidente";
import { HistorialIncidenteModal } from "../HistorialIncidenteModal";
import { CerrarIncidenteDialog } from "../CerrarIncidenteDialog";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { useReclamoDeIncidente } from "../../../reclamos/hooks/useReclamoDeIncidente";
import { listarRetiros } from "../../../retiros/services/retiroService";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
  formatoFechaCierre,
} from "../../types/incidente";
import { BannerError, BotonCancelar, BotonTexto, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import { VisorFoto } from "../../../../components/ui/VisorFoto";
import { DisposicionDetalle, PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";
import { useAuth } from "../../../../common/context/useAuth";

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { incidente, loading, error, recargar } = useIncidente(Number(id));
  const { historial, loading: loadingHistorial, cargarHistorial, limpiarHistorial } = useHistorialIncidente();
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [buscandoRetiro, setBuscandoRetiro] = useState(false);
  const [modalCerrarAbierto, setModalCerrarAbierto] = useState(false);

  const esAdmin = user?.puede_administrar ?? false;
  const cerrado = incidente?.estado === "cerrado";
  const mostrarBotonCerrar = esAdmin && !cerrado;

  const loteIdIncidente = incidente?.lote_id;
  const handleVerRetiro = useCallback(async () => {
    if (!loteIdIncidente) return;
    setBuscandoRetiro(true);
    try {
      const retiros = await listarRetiros({ lote_id: loteIdIncidente });
      const retiro = retiros[0];
      if (retiro) {
        navigate(`/retiros/${retiro.id}`);
      }
    } catch {
      // No crítico: si no se encuentra el retiro, simplemente no navegamos.
    } finally {
      setBuscandoRetiro(false);
    }
  }, [loteIdIncidente, navigate]);

  const handleCerrarIncidente = async () => {
    try {
      await recargar(); // Recargar el incidente para actualizar el estado
      setModalCerrarAbierto(false);
    } catch (err) {
      console.error("Error al cerrar incidente:", err);
    }
  };

  const handleAbrirModalCerrar = () => setModalCerrarAbierto(true);
  const handleCerrarModalCerrar = () => setModalCerrarAbierto(false);

  const esReclamoCliente = incidente?.tipo === "reclamo_cliente";
  const esEntregaRechazada = incidente?.tipo === "entrega_rechazada";
  const esRetiroLote = incidente?.tipo === "retiro_lote";
  // Solo se consulta cuando el incidente es de reclamo: en el resto de los
  // tipos no hay un reclamo vinculado que mostrar.
  const { reclamos } = useReclamoDeIncidente(
    esReclamoCliente ? incidente?.id ?? null : null
  );
  const reclamoVinculado = reclamos[0];

  // Si el usuario viene de "Mis Reportes" (operador), vuelve ahí. Si viene de
  // la gestión (admin), vuelve a la lista de gestión.
  const backUrl = location.state?.from === "mis-reportes" ? "/incidentes/reportar" : "/incidentes";
  const volver = {
    a: backUrl,
    etiqueta: backUrl === "/incidentes" ? "Incidentes" : "Mis reportes",
  };

  // El hook de imagen debe ir ANTES de los early returns: si no, cuando loading
  // es true o hay error, el componente retorna antes de llegar al hook y React
  // se queja de que el número de hooks cambió entre renders.
  const imagen = useImagenAutenticada(incidente?.foto_url);

  if (loading) {
    return (
      <PaginaDetalle volver={volver} titulo="Incidente">
        <EstadoCargando>Cargando incidente...</EstadoCargando>
      </PaginaDetalle>
    );
  }

  if (error || !incidente) {
    return (
      <PaginaDetalle volver={volver} titulo="Incidente">
        <BannerError>{error || "No se encontró el incidente"}</BannerError>
      </PaginaDetalle>
    );
  }

  const handleVerHistorial = async () => {
    setMostrarHistorial(true);
    await cargarHistorial(incidente.id);
  };

  const handleCerrarHistorial = () => {
    setMostrarHistorial(false);
    limpiarHistorial();
  };

  return (
    <>
      <PaginaDetalle
        volver={volver}
        titulo={`${incidente.titulo} #${incidente.id}`}
        descripcion={`Reportado el ${formatoFecha(incidente.fecha_reporte)}`}
        estado={
          <EtiquetaEstado tono={cerrado ? "ok" : "alerta"}>
            {estadoLabel(incidente.estado)}
          </EtiquetaEstado>
        }
        acciones={
          <>
            <BotonCancelar loading={loadingHistorial} onClick={handleVerHistorial}>
              <LuHistory aria-hidden />
              Ver historial
            </BotonCancelar>
            {mostrarBotonCerrar && (
              <Button
                colorPalette="red"
                variant="surface"
                size="sm"
                onClick={handleAbrirModalCerrar}
                aria-label="Cerrar incidente"
              >
                <LuX size={16} aria-hidden />
                Cerrar incidente
              </Button>
            )}
          </>
        }
      >
        {/* Principal: descripción, evidencia y resolución; lateral: origen
            (aviso con enlaces), tipo y metadatos del reporte. */}
        <DisposicionDetalle
          lateralPrimero
          lateral={
            <>
            {(esEntregaRechazada || esReclamoCliente || esRetiroLote) && (
              <Alert.Root
                status={esRetiroLote ? "error" : esEntregaRechazada ? "warning" : "info"}
                mb="6"
                alignItems="flex-start"
              >
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {esRetiroLote
                      ? "Incidente generado por un retiro de lote"
                      : esEntregaRechazada
                      ? "Incidente generado por un rechazo"
                      : "Incidente generado por un reclamo"}
                  </Alert.Title>
                  <Alert.Description>
                    {esRetiroLote
                      ? "Este incidente se abrió al iniciar el retiro del lote. No se puede cerrar ni reabrir desde acá: se cierra desde Cerrar retiro en la ficha del retiro."
                      : esEntregaRechazada
                      ? "Este incidente no se puede cerrar ni reabrir desde acá: se resuelve desde Resolver rechazo en la salida."
                      : "Se abrió automáticamente al registrar el reclamo de cliente. Se cierra desde esta pantalla cuando se resuelve."}
                  </Alert.Description>
                  <HStack gap="3" flexWrap="wrap" mt="3">
                    {incidente.lote_id && (
                      <BotonTexto
                        onClick={() => navigate(`/lotes/${incidente.lote_id}`)}
                        title="Ver la ficha del lote"
                      >
                        Ver lote
                      </BotonTexto>
                    )}
                    {incidente.salida_id && (
                      <BotonTexto
                        onClick={() =>
                          navigate(`/salidas/${incidente.salida_id}/detalle`)
                        }
                        title="Ver la salida asociada"
                      >
                        Ver salida
                      </BotonTexto>
                    )}
                    {reclamoVinculado && (
                      <BotonTexto
                        onClick={() => navigate(`/reclamos/${reclamoVinculado.id}`)}
                        title="Ver la ficha del reclamo"
                      >
                        Ver reclamo
                      </BotonTexto>
                    )}
                    {esRetiroLote && (
                      <BotonTexto
                        onClick={handleVerRetiro}
                        title="Ver la ficha del retiro"
                        disabled={buscandoRetiro}
                      >
                        {buscandoRetiro ? "Buscando retiro…" : "Ver retiro"}
                      </BotonTexto>
                    )}
                  </HStack>
                </Alert.Content>
              </Alert.Root>
            )}
              <SeccionDetalle titulo="Datos del incidente">
                <Stack gap="4">
                {/* Tipo */}
                <Box>
                  <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="1">
                    Tipo de incidente
                  </Text>
                  <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="2" py="1">
                    {tipoLabel(incidente.tipo)}
                  </Badge>
                </Box>
                {/* Metadatos */}
                <Box
                  p="4"
                  bg="bg.subtle"
                  borderWidth="1px"
                  borderColor="border"
                  rounded="lg"
                >
                  <VStack align="start" gap="3">
                    <Text fontSize="md" wordBreak="break-word">
                      <strong>Reportado por:</strong>{" "}
                      {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
                    </Text>
                    <Text fontSize="md" wordBreak="break-word">
                      <strong>Fecha y hora:</strong>{" "}
                      {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
                    </Text>
                    {incidente.equipo_nombre && (
                      /*
                       * Sin `wordBreak`, un nombre de equipo sin espacios (una sola
                       * "palabra" larga) no tenía dónde cortar y se salía del
                       * recuadro. Con `break-word` el texto sigue en el renglón de
                       * abajo y el recuadro crece: el nombre completo se lee.
                       */
                      <Text fontSize="md" wordBreak="break-word">
                        <strong>Equipo:</strong> {incidente.equipo_nombre}
                      </Text>
                    )}
                  </VStack>
                </Box>
                </Stack>
              </SeccionDetalle>
            </>
          }
        >
          <SeccionDetalle css={{ "& > *:last-child": { marginBottom: "0" } }}>
          {/* Descripción */}
          <Box mb="6">
            <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="2">
              Descripción
            </Text>
            <Box
              p="4"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border"
              rounded="lg"
              whiteSpace="pre-line"
              lineHeight={1.7}
            >
              <Text fontSize="md" wordBreak="break-word">
                {incidente.descripcion}
              </Text>
            </Box>
          </Box>

          {/* Evidencia fotográfica */}
          {incidente.foto_url && (
            <Box mb="6">
              <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="1">
                Evidencia fotográfica
              </Text>
              <Box
                display="flex"
                justifyContent="center"
                p="4"
                bg="bg.subtle"
                rounded="lg"
                borderWidth="1px"
                borderColor="border"
              >
                {imagen.loading && (
                  <Text fontSize="sm" color="fg.muted">Cargando imagen...</Text>
                )}
                {!imagen.loading && imagen.error && (
                  <Text fontSize="sm" color="red.fg">{imagen.error}</Text>
                )}
                {imagen.src && (
                  <Image
                    src={imagen.src}
                    alt="Evidencia del incidente"
                    w="100%"
                    maxH="400px"
                    objectFit="contain"
                    rounded="lg"
                    cursor="pointer"
                    onClick={() => setImagenAmpliada(true)}
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Resolución: qué se hizo, cuándo y quién lo resolvió */}
          {cerrado && (
            <Box
              mb="6"
              p="4"
              bg="green.subtle"
              borderWidth="1px"
              borderColor="green.border"
              rounded="lg"
            >
              <Text
                fontSize="md"
                color="green.fg"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                gap="2"
              >
                <LuCircleCheck size={20} aria-hidden />
                Incidente cerrado
              </Text>

              <VStack align="start" gap="2" mt="3">
                <Text fontSize="sm" color="green.fg">
                  <strong>Acción correctiva:</strong>{" "}
                  {incidente.observacion_cierre ?? "Sin detalle registrado."}
                </Text>
                <Text fontSize="sm" color="green.fg">
                  <strong>Fecha de cierre:</strong>{" "}
                  {formatoFechaCierre(incidente.fecha_cierre)}
                </Text>
                <Text fontSize="sm" color="green.fg">
                  <strong>Responsable de la resolución:</strong>{" "}
                  {incidente.responsable_cierre_nombre ??
                    (incidente.responsable_cierre_id
                      ? `Usuario #${incidente.responsable_cierre_id}`
                      : "-")}
                </Text>
              </VStack>
            </Box>
          )}
          </SeccionDetalle>
        </DisposicionDetalle>
      </PaginaDetalle>

      {/* Imagen ampliada */}
      {imagenAmpliada && imagen.src && (
        <VisorFoto
          src={imagen.src}
          alt="Evidencia ampliada"
          onClose={() => setImagenAmpliada(false)}
        />
      )}

      {/* Modal de historial */}
      <HistorialIncidenteModal
        isOpen={mostrarHistorial}
        historial={historial}
        loading={loadingHistorial}
        onClose={handleCerrarHistorial}
      />

      {/* Modal para cerrar incidente (solo admin) */}
      <CerrarIncidenteDialog
        isOpen={modalCerrarAbierto}
        incidente={incidente}
        onClose={handleCerrarModalCerrar}
        onConfirm={handleCerrarIncidente}
      />
    </>
  );
}
