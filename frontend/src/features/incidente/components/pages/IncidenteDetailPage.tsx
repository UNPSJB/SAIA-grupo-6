import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Box, Button, Badge, Heading, Text, HStack, VStack } from "@chakra-ui/react";
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
import {
  EXITO_FONDO_CLARO,
  EXITO_TEXTO,
  FONDO_CARD,
  FONDO_NEUTRO,
  GRIS_MEDIO,
  TEAL,
  TEAL_OSCURO,
} from "../../../../common/theme/tokens";

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
    return <Box p="20px">Cargando incidente...</Box>;
  }

  if (error || !incidente) {
    return (
      <Box p="20px" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Text color="red.500">{error || "No se encontró el incidente"}</Text>
        <Button
          mt="16px"
          bg={GRIS_MEDIO}
          color="white"
          height="auto"
          onClick={() => navigate(backUrl)}
          style={{ padding: "8px 16px", borderRadius: "6px" }}
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
      <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {/* Encabezado */}
        <HStack justify="space-between" mb="16px">
          <Heading as="h2" size="lg" fontWeight="bold" color="black">
            {incidente.titulo} #{incidente.id}
          </Heading>
          <Button
            bg={GRIS_MEDIO}
            color="white"
            height="auto"
            onClick={() => navigate(backUrl)}
            style={{ padding: "8px 16px", borderRadius: "6px" }}
          >
            Volver a la lista
          </Button>
        </HStack>

        {/* Estado */}
        <Box mb="20px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
            Estado
          </Text>
          <Badge
            colorPalette={cerrado ? "green" : "red"}
            borderRadius="md"
            px="16px"
            py="6px"
            fontSize="16px"
            fontWeight="bold"
          >
            {estadoLabel(incidente.estado).toUpperCase()}
          </Badge>
        </Box>

        {/* Tipo */}
        <Box mb="20px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
            Tipo de Incidente
          </Text>
          <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="12px" py="6px" fontSize="16px">
            {tipoLabel(incidente.tipo)}
          </Badge>
        </Box>

        {/* Descripción */}
        <Box mb="24px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="10px" textTransform="uppercase">
            Descripción
          </Text>
          <Box
            p="20px"
            style={{
              backgroundColor: FONDO_CARD,
              border: "1px solid #d8e7e5",
              borderRadius: "10px",
              whiteSpace: "pre-line",
              lineHeight: 1.7,
            }}
          >
            <Text fontSize="16px">{incidente.descripcion}</Text>
          </Box>
        </Box>

        {/* Metadatos */}
        <Box
          mb="24px"
          p="20px"
          style={{
            backgroundColor: FONDO_CARD,
            border: "1px solid #d8e7e5",
            borderRadius: "10px",
          }}
        >
          <VStack align="start" gap="12px">
            <Text fontSize="16px">
              <strong>Reportado por:</strong>{" "}
              {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
            </Text>
            <Text fontSize="16px">
              <strong>Fecha y hora:</strong>{" "}
              {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
            </Text>
            {incidente.equipo_nombre && (
              <Text fontSize="16px">
                <strong>Equipo:</strong> {incidente.equipo_nombre}
              </Text>
            )}
          </VStack>
        </Box>

        {/* Evidencia fotográfica */}
        {incidente.foto_url && (
          <Box mb="24px">
            <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
              Evidencia Fotográfica
            </Text>
            <Box
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px",
                backgroundColor: FONDO_NEUTRO,
                borderRadius: "10px",
                border: "1px solid #eee",
              }}
            >
              {imagen.loading && (
                <Text fontSize="14px" color="gray.500">Cargando imagen...</Text>
              )}
              {!imagen.loading && imagen.error && (
                <Text fontSize="14px" color="red.500">{imagen.error}</Text>
              )}
              {imagen.src && (
                <img
                  src={imagen.src}
                  alt="Evidencia del incidente"
                  onClick={() => setImagenAmpliada(true)}
                  style={{
                    width: "100%",
                    maxHeight: "400px",
                    objectFit: "contain",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Resolución: qué se hizo, cuándo y quién lo resolvió */}
        {cerrado && (
          <Box
            mb="24px"
            p="20px"
            style={{
              backgroundColor: EXITO_FONDO_CLARO,
              border: "1px solid #c6f6d5",
              borderRadius: "10px",
            }}
          >
            <Text fontSize="16px" color={EXITO_TEXTO} fontWeight="bold">
              ✅ Incidente cerrado
            </Text>

            <VStack align="start" gap="8px" mt="12px">
              <Text fontSize="15px" color={EXITO_TEXTO}>
                <strong>Acción correctiva:</strong>{" "}
                {incidente.observacion_cierre ?? "Sin detalle registrado."}
              </Text>
              <Text fontSize="15px" color={EXITO_TEXTO}>
                <strong>Fecha de cierre:</strong>{" "}
                {formatoFechaCierre(incidente.fecha_cierre)}
              </Text>
              <Text fontSize="15px" color={EXITO_TEXTO}>
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
        <HStack gap="10px" mt="20px">
          <Button
            bg={TEAL}
            color="white"
            height="auto"
            loading={loadingHistorial}
            onClick={handleVerHistorial}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
            _hover={{ bg: TEAL_OSCURO }}
          >
            Ver historial
          </Button>
        </HStack>
      </Box>

      {/* Imagen ampliada */}
      {imagenAmpliada && imagen.src && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onClick={() => setImagenAmpliada(false)}
        >
          <img
            src={imagen.src}
            alt="Evidencia ampliada"
            style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "8px" }}
          />
        </Box>
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
