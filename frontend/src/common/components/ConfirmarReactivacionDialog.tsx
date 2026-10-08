import { Box, Button, Portal, Text } from "@chakra-ui/react";

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
        position="fixed"
        inset={0}
        bg="blackAlpha.600"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={1000}
      >
        <Box
          bg="white"
          p="6"
          rounded="l2"
          boxShadow="0 4px 15px rgba(0,0,0,0.2)"
          width="380px"
          textAlign="center"
        >
          <Box fontSize="36px" mb="2">♻️</Box>
          <Text as="h3" fontWeight="bold" color="gray.800" mt={0}>
            Registro dado de baja encontrado
          </Text>
          <Text color="gray.600" mb="5" fontSize="15px">
            {mensaje}
          </Text>
          <Box display="flex" gap="10px" justifyContent="center">
            <Button
              onClick={onCancel}
              height="auto"
              minW="auto"
              p="8px 16px"
              rounded="md"
              variant="outline"
              borderColor="gray.300"
              colorPalette="gray"
              fontWeight="bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              loading={isLoading}
              height="auto"
              minW="auto"
              p="8px 16px"
              rounded="md"
              colorPalette="brand"
              fontWeight="bold"
            >
              Sí, reactivar
            </Button>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
