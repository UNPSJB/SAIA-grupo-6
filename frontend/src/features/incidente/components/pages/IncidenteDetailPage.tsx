import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Badge, Box, Button, Heading, Image, Portal, Text, VStack } from "@chakra-ui/react";
import { useIncidente } from "../../hooks/useIncidente";
import { useHistorialIncidente } from "../../hooks/useHistorialIncidente";
import { HistorialIncidenteModal } from "../HistorialIncidenteModal";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import {
  estadoLabel,
  tipoLabel,
  tipoColor,
  formatoFechaCierre,
} from "../../types/incidente";
import { BannerError } from "../../../../components/ui/patrones";

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
    return <Box p="5">Cargando incidente...</Box>;
  }

  if (error || !incidente) {
    return (
      <Box p="5" maxW="600px" mx="auto">
        <BannerError>{error || "No se encontró el incidente"}</BannerError>
        <Button
          mt="4"
          colorPalette="gray"
          variant="outline"
          borderColor="gray.300"
          height="auto"
          px="4"
          py="2"
          rounded="md"
          fontWeight="bold"
          onClick={() => navigate(backUrl)}
        >
          Volver a la lista
        </Button>
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
        {/* Encabezado */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          gap="4"
          flexWrap="wrap"
          mb="4"
        >
          <Heading as="h2" size="lg" fontWeight="bold" color="gray.900">
            {incidente.titulo} #{incidente.id}
          </Heading>
          <Button
            colorPalette="gray"
            variant="outline"
            borderColor="gray.300"
            height="auto"
            px="4"
            py="2"
            rounded="md"
            fontWeight="bold"
            onClick={() => navigate(backUrl)}
          >
            Volver a la lista
          </Button>
        </Box>

        {/* Estado */}
        <Box mb="5">
          <Text fontSize="sm" color="gray.500" fontWeight="bold" mb="1.5" textTransform="uppercase">
            Estado
          </Text>
          <Badge
            colorPalette={cerrado ? "green" : "red"}
            variant="subtle"
            borderRadius="md"
            px="4"
            py="1.5"
            fontSize="md"
            fontWeight="bold"
          >
            {estadoLabel(incidente.estado).toUpperCase()}
          </Badge>
        </Box>

        {/* Tipo */}
        <Box mb="5">
          <Text fontSize="sm" color="gray.500" fontWeight="bold" mb="1.5" textTransform="uppercase">
            Tipo de Incidente
          </Text>
          <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="3" py="1.5" fontSize="md">
            {tipoLabel(incidente.tipo)}
          </Badge>
        </Box>

        {/* Descripción */}
        <Box mb="6">
          <Text fontSize="sm" color="gray.500" fontWeight="bold" mb="2.5" textTransform="uppercase">
            Descripción
          </Text>
          <Box
            p="5"
            bg="brand.50"
            borderWidth="1px"
            borderColor="brand.200"
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
          p="5"
          bg="brand.50"
          borderWidth="1px"
          borderColor="brand.200"
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
            <Text fontSize="sm" color="gray.500" fontWeight="bold" mb="1.5" textTransform="uppercase">
              Evidencia Fotográfica
            </Text>
            <Box
              display="flex"
              justifyContent="center"
              p="4"
              bg="gray.50"
              rounded="lg"
              borderWidth="1px"
              borderColor="gray.200"
            >
              {imagen.loading && (
                <Text fontSize="sm" color="gray.500">Cargando imagen...</Text>
              )}
              {!imagen.loading && imagen.error && (
                <Text fontSize="sm" color="red.500">{imagen.error}</Text>
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
            p="5"
            bg="green.50"
            borderWidth="1px"
            borderColor="green.200"
            rounded="lg"
          >
            <Text fontSize="md" color="green.700" fontWeight="bold">
              ✅ Incidente cerrado
            </Text>

            <VStack align="start" gap="2" mt="3">
              <Text fontSize="sm" color="green.700">
                <strong>Acción correctiva:</strong>{" "}
                {incidente.observacion_cierre ?? "Sin detalle registrado."}
              </Text>
              <Text fontSize="sm" color="green.700">
                <strong>Fecha de cierre:</strong>{" "}
                {formatoFechaCierre(incidente.fecha_cierre)}
              </Text>
              <Text fontSize="sm" color="green.700">
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
        <Button
          colorPalette="brand"
          height="auto"
          px="5"
          py="2.5"
          rounded="md"
          fontWeight="bold"
          loading={loadingHistorial}
          onClick={handleVerHistorial}
        >
          Ver historial
        </Button>
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
            p="20px"
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