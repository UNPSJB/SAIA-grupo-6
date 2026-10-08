import { Button, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
export interface ConfirmDialogProps {
  /** Abre el diálogo. Cuando es `false` no se renderiza nada. */
  isOpen: boolean;
  /** Encabezado. Acepta `ReactNode` para resaltar el nombre del registro. */
  titulo: ReactNode;
  /** Texto explicativo que va debajo del encabezado. */
  mensaje: ReactNode;
  /** Etiqueta del botón de confirmación. */
  textoConfirmar?: string;
  /** Etiqueta del botón de cancelación. */
  textoCancelar?: string;
  /** Muestra el spinner en el botón de confirmación. */
  isLoading?: boolean;
  /**
   * Paleta del botón de confirmación. Por defecto `red` porque casi todos los
   * usos son eliminados; se sobreescribe para confirmaciones que no son
   * destructivas (por ejemplo, activar algo).
   */
  confirmPalette?: string;
  /** Acción de confirmación. */
  onConfirm: () => void;
  /** Acción de cancelación. */
  onCancel: () => void;
}

/**
 * Diálogo de confirmación genérico.
 *
 * Reemplaza a los ocho `Delete*Dialog` que cada feature mantenía por su
 * cuenta (todos idénticos salvo el nombre de la entidad). No sabe si
 * confirma una baja, una reactivación o cualquier otra cosa: solo recibe
 * el texto a mostrar y qué hacer al confirmar o cancelar. Cada call site
 * arma su propio `titulo` y su propio `mensaje`.
 *
 * El botón "Cancelar" es la única vía de cierre, tal como era antes: el
 * diálogo no se cierra con Escape ni clickeando fuera. Quien lo usa es
 * responsable de poner el guard de `isLoading` en `onCancel` si quiere
 * impedir que se cierre mientras hay una mutación en vuelo.
 */
export function ConfirmDialog({
  isOpen,
  titulo,
  mensaje,
  textoConfirmar = "Sí, eliminar",
  textoCancelar = "Cancelar",
  isLoading,
  confirmPalette = "red",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <DialogRoot
      open
      placement="center"
      motionPreset="none"
      closeOnEscape={false}
      closeOnInteractOutside={false}
    >
      <DialogContent
        width="350px"
        maxWidth="350px"
        padding="6"
        rounded="l2"
        bg="white"
        textAlign="center"
      >
        <DialogTitle as="h3" fontWeight="bold" color="gray.800">
          {titulo}
        </DialogTitle>
        <DialogDescription color="gray.600" mb="5">
          {mensaje}
        </DialogDescription>
        <HStack justify="center" gap="10px">
          <Button
            onClick={onCancel}
            height="auto"
            minW="auto"
            padding="8px 16px"
            variant="outline"
            borderColor="gray.300"
            rounded="md"
            colorPalette="gray"
            fontWeight="bold"
          >
            {textoCancelar}
          </Button>
          <Button
            onClick={onConfirm}
            loading={isLoading}
            height="auto"
            minW="auto"
            padding="8px 16px"
            rounded="md"
            fontWeight="bold"
            colorPalette={confirmPalette}
          >
            {textoConfirmar}
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}