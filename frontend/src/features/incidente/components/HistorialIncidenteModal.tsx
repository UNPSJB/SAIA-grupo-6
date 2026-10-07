import { Box, Button, Portal, Text, VStack } from "@chakra-ui/react";
import type { HistorialIncidenteItem } from "../types/incidente";
import { formatoFecha } from "../types/incidente";
import {
  BLANCO,
  BORDE_CONTROL,
  TEAL,
  TEXTO_PRIMARIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../common/theme/tokens";

interface HistorialIncidenteModalProps {
  isOpen: boolean;
  historial: HistorialIncidenteItem[] | null;
  loading: boolean;
  onClose: () => void;
}

/**
 * Modal que muestra el historial de cierre/reapertura de un incidente.
 * Similar al historial de checklist: una línea de tiempo con fecha, usuario
 * y observación de cada evento.
 */
export function HistorialIncidenteModal({
  isOpen,
  historial,
  loading,
  onClose,
}: HistorialIncidenteModalProps) {
  if (!isOpen) return null;

  return (
    <Portal>
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
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "500px",
            maxWidth: "90vw",
            maxHeight: "80vh",
            overflowY: "auto",
            textAlign: "left",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box as="h3" style={{ marginTop: 0, color: TEXTO_PRIMARIO }}>
            Historial del incidente
          </Box>

          {loading && (
            <Text color={TEXTO_TERCIARIO}>Cargando historial...</Text>
          )}

          {!loading && historial && historial.length === 0 && (
            <Text color={TEXTO_TERCIARIO}>
              Este incidente todavía no tiene eventos registrados.
            </Text>
          )}

          {!loading && historial && historial.length > 0 && (
            <VStack align="stretch" gap="16px" mt="16px">
              {historial.map((evento) => (
                <Box
                  key={evento.id}
                  style={{
                    borderLeft: `3px solid ${TEAL}`,
                    paddingLeft: "12px",
                  }}
                >
                  <Text fontSize="14px" fontWeight="bold" color={TEXTO_PRIMARIO}>
                    {evento.estado_nuevo === "abierto" ? "🔓 Reapertura" : "🔒 Cierre"}
                  </Text>
                  <Text fontSize="13px" color={TEXTO_SECUNDARIO}>
                    {formatoFecha(evento.fecha_evento)} — {evento.usuario_nombre ?? `Usuario #${evento.usuario_id}`}
                  </Text>
                  {evento.observacion && (
                    <Text fontSize="13px" color={TEXTO_TERCIARIO} mt="4px">
                      {evento.observacion}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          )}

          <Box
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <Button
              onClick={onClose}
              height="auto"
              minW="auto"
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: `1px solid ${BORDE_CONTROL}`,
                backgroundColor: BLANCO,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cerrar
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
