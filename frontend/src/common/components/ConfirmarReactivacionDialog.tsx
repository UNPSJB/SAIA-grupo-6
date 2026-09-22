import { Box, Button, Portal } from "@chakra-ui/react";

interface ConfirmarReactivacionDialogProps {
  isOpen: boolean;
  mensaje: string;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Diálogo genérico: no sabe si es una Persona, un Equipo o un Insumo.
// Solo necesita el mensaje a mostrar y qué hacer al confirmar/cancelar.
// Cada feature arma su propio `mensaje` (viene del backend, en `err.message`
// de un ConflictoInactivoError) y decide qué hacer en `onConfirm`.
export function ConfirmarReactivacionDialog({
  isOpen,
  mensaje,
  isLoading,
  onCancel,
  onConfirm,
}: ConfirmarReactivacionDialogProps) {
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
      >
        <Box
          style={{
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "380px",
            textAlign: "center",
          }}
        >
          <Box style={{ fontSize: "36px", marginBottom: "8px" }}>♻️</Box>
          <Box as="h3" style={{ marginTop: 0, color: "#333" }}>
            Registro dado de baja encontrado
          </Box>
          <Box style={{ color: "#666", marginBottom: "20px", fontSize: "15px" }}>
            {mensaje}
          </Box>
          <Box
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <Button
              onClick={onCancel}
              height="auto"
              minW="auto"
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              loading={isLoading}
              height="auto"
              minW="auto"
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#468189",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Sí, reactivar
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
