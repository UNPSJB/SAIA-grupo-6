import { useState } from "react";
import { Box, Portal, Text } from "@chakra-ui/react";
import { useImagenAutenticada } from "../../../common/hooks/useImagenAutenticada";
import { BORDE_SUAVE, FONDO_APP, TEAL, TEAL_CLARO } from "../../../common/theme/tokens";

/**
 * Marco fijo de la miniatura. Se comparte entre los tres estados (cargando,
 * error y foto) para que la columna no baile de alto mientras carga.
 */
const MARCO = {
  width: "72px",
  height: "72px",
  borderRadius: "8px",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "#e8f0ef",
  backgroundColor: FONDO_APP,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

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
      <Box {...MARCO} p="8px">
        <Box
          width="100%"
          height="100%"
          borderRadius="6px"
          backgroundColor={BORDE_SUAVE}
        />
      </Box>
    );
  }

  if (imagen.error || !imagen.src) {
    return (
      <Box {...MARCO} title={imagen.error || "No se pudo cargar la foto"}>
        <Text fontSize="12px" color="gray.400">
          —
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box
        {...MARCO}
        borderColor={TEAL_CLARO}
        cursor="pointer"
        title="Ver foto ampliada"
        onClick={() => setAmpliada(true)}
        _hover={{ borderColor: TEAL }}
      >
        <img
          src={imagen.src}
          alt="Foto del incidente"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Box>

      {ampliada && (
        <Portal>
          <Box
            position="fixed"
            inset={0}
            bg="rgba(0,0,0,0.85)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            zIndex={2000}
            padding="20px"
            cursor="zoom-out"
            onClick={() => setAmpliada(false)}
          >
            <img
              src={imagen.src}
              alt="Foto ampliada del incidente"
              style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: "8px" }}
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
      <Text fontSize="16px" color="gray.300" title="Sin foto">
        —
      </Text>
    );
  }
  return <MiniaturaFoto rutaFoto={rutaFoto} />;
}