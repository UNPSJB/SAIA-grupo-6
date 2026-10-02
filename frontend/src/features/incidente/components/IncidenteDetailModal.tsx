import { useState } from "react";
import { Box, Button, Badge, Heading, Text, HStack } from "@chakra-ui/react";
import type { Incidente, TipoIncidente } from "../types/incidente";
import { TIPOS_INCIDENTE } from "../types/incidente";

interface IncidenteDetailModalProps {
  isOpen: boolean;
  incidente: Incidente | null;
  onClose: () => void;
}

const TEAL = "#468189";

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

export function IncidenteDetailModal({ isOpen, incidente, onClose }: IncidenteDetailModalProps) {
  if (!isOpen || !incidente) return null;

  const [imagenAmpliada, setImagenAmpliada] = useState(false);

  return (
    <>
      {/* Modal de detalle */}
      <Box
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={onClose}
      >
        <Box
          style={{
            backgroundColor: "white",
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <HStack justify="space-between" mb="20px">
            <Heading as="h3" size="md" style={{ margin: 0, color: TEAL }}>
              Incidente #{incidente.id}
            </Heading>
            <Badge
              colorPalette={incidente.activo ? "red" : "green"}
              borderRadius="md"
              px="12px"
              py="4px"
            >
              {incidente.activo ? "ABIERTO" : "CERRADO"}
            </Badge>
          </HStack>

          {/* Tipo */}
          <Box mb="16px">
            <Text fontSize="12px" color="gray.500" fontWeight="bold" mb="4px">
              TIPO DE INCIDENTE
            </Text>
            <Badge colorPalette={tipoColor(incidente.tipo)} borderRadius="md" px="8px" py="4px">
              {tipoLabel(incidente.tipo)}
            </Badge>
          </Box>

          {/* Metadatos */}
          <Box
            mb="20px"
            p="16px"
            style={{
              backgroundColor: "#f7faf9",
              border: "1px solid #d8e7e5",
              borderRadius: "8px",
            }}
          >
            <Text fontSize="14px" mb="8px">
              <strong>Reportado por:</strong>{" "}
              {incidente.usuario_nombre ?? `Usuario #${incidente.usuario_id}`}
            </Text>
            <Text fontSize="14px" mb="8px">
              <strong>Fecha y hora:</strong>{" "}
              {new Date(incidente.fecha_reporte).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })}
            </Text>
            <Text fontSize="14px">
              <strong>Equipo:</strong> {incidente.equipo_nombre ?? "No asociado"}
            </Text>
          </Box>

          {/* Descripción completa */}
          <Box mb="20px">
            <Text fontSize="12px" color="gray.500" fontWeight="bold" mb="4px">
              DESCRIPCIÓN
            </Text>
            <Text
              fontSize="15px"
              wordBreak="break-word"
              style={{
                whiteSpace: "pre-line",
                overflowWrap: "break-word",
                padding: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: "6px",
                border: "1px solid #eee",
              }}
            >
              {incidente.descripcion}
            </Text>
          </Box>

          {/* Evidencia fotográfica */}
          {incidente.foto_url && (
            <Box mb="20px">
              <Text fontSize="12px" color="gray.500" fontWeight="bold" mb="4px">
                EVIDENCIA FOTOGRÁFICA
              </Text>
              <img
                src={`http://localhost:8000/${incidente.foto_url.replace(/\\/g, "/")}`}
                alt="Evidencia del incidente"
                style={{
                  maxWidth: "100%",
                  maxHeight: "300px",
                  borderRadius: "8px",
                  border: "2px solid #90BEBB",
                  cursor: "pointer",
                }}
                onClick={() => setImagenAmpliada(true)}
              />
            </Box>
          )}

          {/* Sección de resolución (si está cerrado) */}
          {!incidente.activo && (
            <Box
              mb="20px"
              p="16px"
              style={{
                backgroundColor: "#f0fff4",
                border: "1px solid #c6f6d5",
                borderRadius: "8px",
              }}
            >
              <Text fontSize="14px" color="#276749" fontWeight="bold">
                ✅ Incidente resuelto
              </Text>
              <Text fontSize="13px" color="#276749" mt="4px">
                Este incidente fue marcado como cerrado. La acción correctiva se
                registrará en una próxima actualización.
              </Text>
            </Box>
          )}

          {/* Botón cerrar */}
          <Button
            onClick={onClose}
            style={{
              backgroundColor: TEAL,
              color: "white",
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "bold",
              width: "100%",
            }}
          >
            Cerrar
          </Button>
        </Box>
      </Box>

      {/* Modal de imagen ampliada */}
      {imagenAmpliada && incidente.foto_url && (
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
            src={`http://localhost:8000/${incidente.foto_url.replace(/\\/g, "/")}`}
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
