import { Box, type BoxProps } from "@chakra-ui/react";
import { usePistaScroll } from "../../common/hooks/usePistaScroll";

/**
 * Bloque que se desplaza de costado y lo muestra: el borde que tiene más
 * contenido se desvanece (ver `usePistaScroll`).
 */
export function Desplazable({ children, ...rest }: BoxProps) {
  const { ref, mascara } = usePistaScroll();
  return (
    <Box ref={ref} overflowX="auto" {...rest} style={{ ...rest.style, maskImage: mascara, WebkitMaskImage: mascara }}>
      {children}
    </Box>
  );
}
