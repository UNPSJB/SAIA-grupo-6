import { useState } from "react";
import { Box, Image, Portal, Text, type BoxProps } from "@chakra-ui/react";
import { useImagenAutenticada } from "../../../common/hooks/useImagenAutenticada";

/**
 * Marco fijo de la miniatura. Se comparte entre los tres estados (cargando,
 * error y foto) para que la columna no baile de alto mientras carga.
 */
const MARCO: BoxProps = {
  w: "72px",
  h: "72px",
  rounded: "lg",
  overflow: "hidden",
  borderWidth: "1px",
  borderColor: "border",
  bg: "bg.subtle",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

/**
 * Miniatura de la foto del incidente. Al hacer clic se abre en pantalla
 * completa.
 *
 * Se usa `objectFit: contain` y no `cover` a propósito: en evidencia
 * alimentaria importa ver la foto completa, no un recorte.
 */
export function MiniaturaFoto({ rutaFoto }: { rutaFoto: string }) {
  const imagen = useImagenAutenticada(rutaFoto);
  const [ampliada, setAmpliada] = useState(false);

  if (imagen.loading) {
    // Skeleton: un texto "Cargando..." no entra en una caja de 72px, y con
    // varias filas a la vez el parpadeo se vuelve un distraction.
    return (
      <Box {...MARCO} p="2">
        <Box
          w="100%"
          h="100%"
          rounded="sm"
          bg="bg.muted"
          aria-hidden
        />
      </Box>
    );
  }

  if (imagen.error || !imagen.src) {
    return (
      <Box {...MARCO} title={imagen.error || "No se pudo cargar la foto"}>
        <Text fontSize="xs" color="fg.subtle">
          —
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box
        {...MARCO}
        borderColor="brand.300"
        cursor="pointer"
        title="Ver foto ampliada"
        onClick={() => setAmpliada(true)}
        _hover={{ borderColor: "brand.500" }}
      >
        <Image
          src={imagen.src}
          alt="Foto del incidente"
          w="100%"
          h="100%"
          objectFit="contain"
        />
      </Box>

      {ampliada && (
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
            onClick={() => setAmpliada(false)}
          >
            <Image
              src={imagen.src}
              alt="Foto ampliada del incidente"
              maxW="90%"
              maxH="90%"
              rounded="lg"
            />
          </Box>
        </Portal>
      )}
    </>
  );
}

/** Celda de la columna Foto: miniatura si hay, guion si no. */
export function CeldaFoto({ rutaFoto }: { rutaFoto: string | null }) {
  if (!rutaFoto) {
    return (
      <Text fontSize="md" color="fg.subtle" title="Sin foto">
        —
      </Text>
    );
  }
  return <MiniaturaFoto rutaFoto={rutaFoto} />;
}