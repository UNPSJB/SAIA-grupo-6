import { Box, Button, Portal, Text } from "@chakra-ui/react";
import type { Insumo } from "../types/insumo";

interface DeleteInsumoDialogProps {
  isOpen: boolean;
  insumo: Insumo | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteInsumoDialog({
  isOpen,
  insumo,
  isLoading,
  onClose,
  onConfirm,
}: DeleteInsumoDialogProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      {/* Overlay */}
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
        {/* Tarjeta */}
        <Box
          style={{
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            width: "350px",
            textAlign: "center",
          }}
        >
          <Box as="h3" style={{ marginTop: 0, color: "#333" }}>
            ¿Esta seguro que desea eliminar el insumo{" "}
            <strong>{insumo?.nombre}</strong>?
          </Box>
          <Text style={{ color: "#666", marginBottom: "20px" }}>
            Esta acción no se puede deshacer.
          </Text>
          <Box
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <Button
              onClick={onClose}
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
                backgroundColor: "#d9534f",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Sí, eliminar
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
