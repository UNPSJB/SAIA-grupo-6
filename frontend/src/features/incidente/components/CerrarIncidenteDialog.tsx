import { useState } from "react";
import { Box, Button, Portal, Text } from "@chakra-ui/react";
import type { Incidente } from "../types/incidente";
import {
  BLANCO,
  BORDE_CONTROL,
  TEAL,
  TEXTO_PRIMARIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../common/theme/tokens";

interface CerrarIncidenteDialogProps {
  isOpen: boolean;
  incidente: Incidente | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (observacionCierre: string) => void;
}

/**
 * Confirmación de cierre de un incidente.
 *
 * El incidente no se borra: queda en estado cerrado con la acción correctiva
 * que se realizó, la fecha de cierre y quién lo resolvió.
 */
export function CerrarIncidenteDialog({
  isOpen,
  incidente,
  isLoading,
  onClose,
  onConfirm,
}: CerrarIncidenteDialogProps) {
  const [observacion, setObservacion] = useState("");

  // Cada vez que se abre el diálogo arranca vacío, así el admin no arrastra
  // el texto del cierre anterior. Se ajusta en render en lugar de en un
  // efecto para no disparar un render extra.
  const [abiertoAnterior, setAbiertoAnterior] = useState(isOpen);
  if (isOpen !== abiertoAnterior) {
    setAbiertoAnterior(isOpen);
    if (isOpen) setObservacion("");
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
            Cerrar incidente <strong>#{incidente.id}</strong>
          </Box>

          <Text style={{ color: TEXTO_TERCIARIO, marginBottom: "15px" }}>
            Se deja asentada la acción correctiva, la fecha de cierre y vos
            como responsable de la resolución.
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
            Acción correctiva (opcional)
          </Box>
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={4}
            placeholder="Ej: Se lavó y desinfectó el equipo y se cambió el termostato."
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
              onClick={() => onConfirm(observacion)}
              loading={isLoading}
              height="auto"
              minW="auto"
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: TEAL,
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cerrar incidente
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}