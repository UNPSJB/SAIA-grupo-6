import { useState } from "react";
import { Box, Button, Portal, Text } from "@chakra-ui/react";
import type { Incidente } from "../types/incidente";
import {
  BLANCO,
  BORDE_CONTROL,
  ADVERTENCIA,
  TEXTO_PRIMARIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../common/theme/tokens";

interface ReabrirIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

/**
 * Confirmación de reapertura de un incidente.
 *
 * El incidente vuelve a estado abierto y se guarda el motivo (opcional)
 * en el historial.
 */
export function ReabrirIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: ReabrirIncidenteDialogProps) {
  const [motivo, setMotivo] = useState("");

  // Cada vez que se abre el diálogo arranca vacío
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) setMotivo("");
  }

  if (!isOpen || !incidente) return null;

  const estiloInput = {
    width: "100%",
    boxSizing: "border-box" as const,
    backgroundColor: BLANCO,
    padding: "10px 12px",
    borderRadius: "8px",
    border: "2px solid #90BEBB",
    fontSize: "14px",
    fontFamily: "inherit",
    color: TEXTO_PRIMARIO,
    resize: "vertical" as const,
  };

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
      >
        <Box
          style={{
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "450px",
            maxWidth: "90vw",
            textAlign: "left",
          }}
        >
          <Box as="h3" style={{ marginTop: 0, color: TEXTO_PRIMARIO }}>
            Reabrir incidente <strong>#{incidente.id}</strong>
          </Box>

          <Text style={{ color: TEXTO_TERCIARIO, marginBottom: "15px" }}>
            El incidente vuelve a estado abierto. Podés dejar un motivo
            (opcional) para dejar registro del cambio.
          </Text>

          <Box
            as="label"
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "6px",
              color: TEXTO_SECUNDARIO,
            }}
          >
            Motivo de reapertura (opcional)
          </Box>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            placeholder="Ej: La solución no funcionó, el equipo sigue fallando."
            style={estiloInput}
          />

          <Box
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "flex-end",
              marginTop: "20px",
            }}
          >
            <Button
              onClick={onClose}
              height="auto"
              minW="auto"
              disabled={isLoading}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: `1px solid ${BORDE_CONTROL}`,
                backgroundColor: BLANCO,
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onConfirm(motivo)}
              loading={isLoading}
              height="auto"
              minW="auto"
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: ADVERTENCIA,
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Reabrir incidente
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
