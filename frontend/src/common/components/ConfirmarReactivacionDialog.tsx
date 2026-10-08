import { Box, Button, HStack } from "@chakra-ui/react";
import { LuRefreshCw } from "react-icons/lu";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";

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

  // Misma estructura que `ConfirmDialog`: antes era un overlay armado a mano
  // (otro color de fondo, otro z-index, sin foco atrapado) y usaba
  // `DialogTitle` fuera de un `DialogRoot`.
  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        width="400px"
        maxWidth="400px"
        padding="6"
        rounded="lg"
        bg="bg.panel"
        boxShadow="dialog"
        textAlign="center"
      >
        <Box color="brand.fg" display="flex" justifyContent="center" mb="2" aria-hidden>
          <LuRefreshCw size={32} />
        </Box>
        <DialogTitle fontSize="lg" fontWeight="bold" color="fg">
          Registro dado de baja encontrado
        </DialogTitle>
        <DialogDescription color="fg.muted" fontSize="sm" mb="6">
          {mensaje}
        </DialogDescription>
        <HStack justify="center" gap="3">
          <Button
            onClick={onCancel}
            variant="outline"
            size="md"
            colorPalette="neutral"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            loading={isLoading}
            size="md"
            colorPalette="brand"
          >
            Sí, reactivar
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}