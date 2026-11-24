import type { ReactNode } from "react";
import { Box, Text } from "@chakra-ui/react";

/** Campo de la fila de registro: etiqueta chica arriba y control de 44px. */
export function CampoRegistro({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Box minW="0">
      <Text as="span" display="block" fontSize="xs" fontWeight="semibold" color="fg.muted" mb="1.5">
        {etiqueta}
      </Text>
      {children}
    </Box>
  );
}
