import { Button, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  BLANCO,
  BORDE_CONTROL,
  PELIGRO,
  TEXTO_PRIMARIO,
  TEXTO_TERCIARIO,
} from "../theme/tokens";

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
        padding="25px"
        borderRadius="12px"
        boxShadow="0 4px 15px rgba(0,0,0,0.2)"
        bg={BLANCO}
        textAlign="center"
      >
        <DialogTitle
          as="h3"
          fontWeight="bold"
          style={{ marginTop: 0, color: TEXTO_PRIMARIO }}
        >
          {titulo}
        </DialogTitle>
        <DialogDescription
          style={{ color: TEXTO_TERCIARIO, marginBottom: "20px" }}
        >
          {mensaje}
        </DialogDescription>
        <HStack justify="center" gap="10px">
          <Button
            onClick={onCancel}
            height="auto"
            minW="auto"
            padding="8px 16px"
            borderRadius="6px"
            border={`1px solid ${BORDE_CONTROL}`}
            backgroundColor={BLANCO}
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
            borderRadius="6px"
            border="none"
            backgroundColor={PELIGRO}
            color={BLANCO}
            fontWeight="bold"
          >
            {textoConfirmar}
          </Button>
        </HStack>
      </DialogContent>
    </DialogRoot>
  );
}