import { useEffect } from "react";
import { Box, Image, Portal } from "@chakra-ui/react";
import { CloseButton } from "./close-button";

interface VisorFotoProps {
  /** URL ya resuelta de la imagen a mostrar. */
  src: string;
  /** Texto alternativo (también se usa como nombre accesible del visor). */
  alt: string;
  onClose: () => void;
}

/**
 * Visor de foto ampliada a pantalla completa.
 *
 * Antes cada pantalla repetía su propio overlay: se cerraba con clic pero no
 * tenía botón visible ni respondía a ESC, así que en teclado o en pantallas
 * táctiles no había forma evidente de salir. Acá se centraliza el
 * comportamiento para que todos los visores se cierren igual:
 *
 *   - botón de cerrar visible arriba a la derecha,
 *   - clic en el fondo oscuro,
 *   - tecla ESC.
 *
 * El clic sobre la propia imagen no cierra: se detiene la propagación para
 * evitar que un zoom accidental termine el visionado.
 */
export function VisorFoto({ src, alt, onClose }: VisorFotoProps) {
  useEffect(() => {
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      // El visor está por encima de todo: que el ESC no cierre además el
      // diálogo o la pantalla que quedó abajo.
      evento.stopPropagation();
      evento.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", manejarTecla, true);
    return () => document.removeEventListener("keydown", manejarTecla, true);
  }, [onClose]);

  return (
    <Portal>
      <Box
        position="fixed"
        inset={0}
        bg="blackAlpha.800"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={2000}
        p="5"
        cursor="zoom-out"
        onClick={onClose}
        onPointerDown={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Foto ampliada"
      >
        <CloseButton
          autoFocus
          position="absolute"
          top="4"
          right="4"
          size="lg"
          color="white"
          bg="blackAlpha.600"
          _hover={{ bg: "blackAlpha.800" }}
          aria-label="Cerrar foto ampliada"
          zIndex={10}
          onClick={(evento) => {
            evento.stopPropagation();
            onClose();
          }}
        />
        <Image
          src={src}
          alt={alt}
          maxW="90%"
          maxH="90%"
          rounded="lg"
          cursor="default"
          onClick={(evento) => evento.stopPropagation()}
        />
      </Box>
    </Portal>
  );
}
