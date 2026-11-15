import { useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Box, HStack, Image, Text, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuHistory } from "react-icons/lu";
import { useIncidente } from "../../hooks/useIncidente";
import { useHistorialIncidente } from "../../hooks/useHistorialIncidente";
import { HistorialIncidenteModal } from "../HistorialIncidenteModal";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { useReclamoDeIncidente } from "../../../reclamos/hooks/useReclamoDeIncidente";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
  formatoFechaCierre,
} from "../../types/incidente";
import { BannerError, BotonCancelar, BotonTexto, EstadoCargando, EtiquetaEstado } from "../../../../components/ui/patrones";
import { VisorFoto } from "../../../../components/ui/VisorFoto";
import { PaginaDetalle, SeccionDetalle } from "../../../../components/ui/plantillas";

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { incidente, loading, error } = useIncidente(Number(id));
  const { historial, loading: loadingHistorial, cargarHistorial, limpiarHistorial } = useHistorialIncidente();
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

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

  const cerrado = incidente.estado === "cerrado";

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
          <BotonCancelar loading={loadingHistorial} onClick={handleVerHistorial}>
            <LuHistory aria-hidden />
            Ver historial
          </BotonCancelar>
        }
      >
        <SeccionDetalle>

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
                    onClick={() =>
                      navigate(`/retiros?incidente_id=${incidente.id}`)
                    }
                    title="Ver la ficha del retiro"
                  >
                    Ver retiro
                  </BotonTexto>
                )}
              </HStack>
            </Alert.Content>
          </Alert.Root>
        )}

        {/* Tipo */}
        <Box mb="4">
          <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="1">
            Tipo de incidente
          </Text>
          <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="2" py="1">
            {tipoLabel(incidente.tipo)}
          </Badge>
        </Box>

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

        {/* Metadatos */}
        <Box
          mb="6"
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
            bg="green.50"
            borderWidth="1px"
            borderColor="green.200"
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
    </>
  );
}