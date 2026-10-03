import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, Badge, Heading, Text, HStack, VStack } from "@chakra-ui/react";
import { useIncidente } from "../../hooks/useIncidente";
import { useImagenAutenticada } from "../../../../common/hooks/useImagenAutenticada";
import { TIPOS_INCIDENTE } from "../../types/incidente";
import type { TipoIncidente } from "../../types/incidente";

function tipoLabel(tipo: TipoIncidente): string {
  return TIPOS_INCIDENTE.find((t) => t.value === tipo)?.label ?? tipo;
}

function tipoColor(tipo: TipoIncidente): string {
  switch (tipo) {
    case "plagas":
      return "red";
    case "falla_equipo":
      return "orange";
    case "devolucion_cliente":
      return "yellow";
    case "higiene_contaminacion":
      return "purple";
    default:
      return "gray";
  }
}

export function IncidenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { incidente, loading, error } = useIncidente(Number(id));
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  // El hook va arriba de todo: no puede declararse después de los returns de
  // loading/error porque cambiaría el orden de hooks entre renders.
  const imagen = useImagenAutenticada(incidente?.foto_url);

  if (loading) {
    return <Box p="20px">Cargando incidente...</Box>;
  }

  if (error || !incidente) {
    return (
      <Box p="20px">
        <Text color="red.500">{error || "No se encontró el incidente"}</Text>
        <Button mt="16px" onClick={() => navigate("/incidentes")}>
          Volver a la lista
        </Button>
      </Box>
    );
  }

  return (
    <>
      <Box style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        {/* Encabezado */}
        <HStack justify="space-between" mb="24px">
          <Heading as="h2" size="lg" fontWeight="bold" color="black">
            Incidente #{incidente.id}
          </Heading>
          <Button
            bg="#6c757d"
            color="white"
            height="auto"
            onClick={() => navigate("/incidentes")}
            style={{ padding: "8px 16px", borderRadius: "6px" }}
          >
            Volver a la lista
          </Button>
        </HStack>

        {/* Badge de estado */}
        <Box mb="24px">
          <Badge
            colorPalette={incidente.activo ? "red" : "green"}
            borderRadius="md"
            px="16px"
            py="6px"
            fontSize="16px"
            fontWeight="bold"
          >
            {incidente.activo ? "ABIERTO" : "CERRADO"}
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

        {/* Metadatos */}
        <Box
          mb="24px"
          p="20px"
          style={{
            backgroundColor: "#f7faf9",
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

        {/* Descripción completa */}
        <Box mb="24px">
          <Text fontSize="14px" color="gray.500" fontWeight="bold" mb="6px" textTransform="uppercase">
            Descripción
          </Text>
          <Text
            fontSize="16px"
            wordBreak="break-word"
            style={{
              whiteSpace: "pre-line",
              overflowWrap: "break-word",
              padding: "16px",
              backgroundColor: "#f9f9f9",
              borderRadius: "8px",
              border: "1px solid #eee",
              lineHeight: "1.6",
            }}
          >
            {incidente.descripcion}
          </Text>
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
                backgroundColor: "#f9f9f9",
                borderRadius: "10px",
                border: "1px solid #eee",
              }}
            >
              {imagen.loading && (
                <Text fontSize="14px" color="gray.500">
                  Cargando imagen...
                </Text>
              )}
              {!imagen.loading && imagen.error && (
                <Text fontSize="14px" color="red.500">
                  {imagen.error}
                </Text>
              )}
              {imagen.src && (
                <img
                  src={imagen.src}
                  alt="Evidencia del incidente"
                  onClick={() => setImagenAmpliada(true)}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "300px",
                    width: "auto",
                    height: "auto",
                    borderRadius: "8px",
                    objectFit: "contain",
                    cursor: "pointer",
                  }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Sección de resolución (si está cerrado) */}
        {!incidente.activo && (
          <Box
            mb="24px"
            p="20px"
            style={{
              backgroundColor: "#f0fff4",
              border: "1px solid #c6f6d5",
              borderRadius: "10px",
            }}
          >
            <Text fontSize="16px" color="#276749" fontWeight="bold">
              ✅ Incidente resuelto
            </Text>
            <Text fontSize="14px" color="#276749" mt="6px">
              Este incidente fue marcado como cerrado. La acción correctiva se
              registrará en una próxima actualización.
            </Text>
          </Box>
        )}
      </Box>

      {/* Modal de imagen ampliada */}
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
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: "8px",
            }}
          />
        </Box>
      )}
    </>
  );
}
