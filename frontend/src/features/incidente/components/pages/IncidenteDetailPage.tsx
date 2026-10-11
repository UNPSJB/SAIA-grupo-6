import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Badge, Box, Image, Portal, Text, VStack } from "@chakra-ui/react";
import { LuCircleCheck, LuHistory } from "react-icons/lu";
import { useIncidente } from "../../hooks/useIncidente";
import { useHistorialIncidente } from "../../hooks/useHistorialIncidente";
import { HistorialIncidenteModal } from "../HistorialIncidenteModal";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFecha,
  formatoFechaCierre,
} from "../../types/incidente";
import {
  BannerError,
  BotonCancelar,
  BotonVolver,
  EstadoCargando,
  PageHeader,
} from "../../../../components/ui/patrones";

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { incidente, loading, error } = useIncidente(Number(id));
  const { historial, loading: loadingHistorial, cargarHistorial, limpiarHistorial } = useHistorialIncidente();
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // Si el usuario viene de "Mis Reportes" (operador), vuelve ahí. Si viene de
  // la gestión (admin), vuelve a la lista de gestión.
  const backUrl = location.state?.from === "mis-reportes" ? "/incidentes/reportar" : "/incidentes";

  // El hook de imagen debe ir ANTES de los early returns: si no, cuando loading
  // es true o hay error, el componente retorna antes de llegar al hook y React
  // se queja de que el número de hooks cambió entre renders.
  const imagen = useImagenAutenticada(incidente?.foto_url);

  if (loading) {
    return (
      <Box p="5">
        <EstadoCargando>Cargando incidente...</EstadoCargando>
      </Box>
    );
  }

  if (error || !incidente) {
    return (
      <Box p="5" maxW="600px" mx="auto">
        <BannerError>{error || "No se encontró el incidente"}</BannerError>
        <BotonVolver mt="4" onClick={() => navigate(backUrl)}>
          Volver a la lista
        </BotonVolver>
      </Box>
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
      <Box p="5" maxW="600px" mx="auto">
        <PageHeader
          title={`${incidente.titulo} #${incidente.id}`}
          description={`Reportado el ${formatoFecha(incidente.fecha_reporte)}`}
          actions={
            <BotonVolver onClick={() => navigate(backUrl)}>
              Volver a la lista
            </BotonVolver>
          }
        />

        {/* Estado */}
        <Box mb="4">
          <Text fontSize="sm" color="fg.muted" fontWeight="medium" mb="1">
            Estado
          </Text>
          <Badge
            colorPalette={cerrado ? "green" : "red"}
            variant="subtle"
            borderRadius="md"
            px="2"
            py="1"
            fontWeight="bold"
          >
            {estadoLabel(incidente.estado)}
          </Badge>
        </Box>

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
            <Text fontSize="md">{incidente.descripcion}</Text>
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
            <Text fontSize="md">
              <strong>Reportado por:</strong>{" "}
              {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
            </Text>
            <Text fontSize="md">
              <strong>Fecha y hora:</strong>{" "}
              {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
            </Text>
            {incidente.equipo_nombre && (
              <Text fontSize="md">
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

        {/* Botón de historial */}
        <BotonCancelar loading={loadingHistorial} onClick={handleVerHistorial}>
          <LuHistory aria-hidden />
          Ver historial
        </BotonCancelar>
      </Box>

      {/* Imagen ampliada */}
      {imagenAmpliada && imagen.src && (
        <Portal>
          <Box
            position="fixed"
            inset={0}
            bg="blackAlpha.800"
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={2000}
            p="5"
            cursor="zoom-out"
            onClick={() => setImagenAmpliada(false)}
          >
            <Image
              src={imagen.src}
              alt="Evidencia ampliada"
              maxW="90%"
              maxH="90%"
              rounded="lg"
            />
          </Box>
        </Portal>
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