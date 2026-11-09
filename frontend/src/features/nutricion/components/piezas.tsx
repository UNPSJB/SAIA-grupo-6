import { Box, Heading, HStack, Text, type BoxProps, type StackProps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons/lib";
import { LuCircleCheck, LuInfo, LuTriangleAlert } from "react-icons/lu";

/**
 * Piezas visuales compartidas por las pantallas de información nutricional.
 * Siguen el lenguaje de `patrones.tsx` (bordes sutiles, títulos `brand.fg`).
 */

/** Bloque de un formulario largo: título con ícono, ayuda y contenido. */
export function Bloque({
  titulo,
  ayuda,
  icono: Icono,
  acciones,
  children,
  ...rest
}: {
  titulo: ReactNode;
  ayuda?: ReactNode;
  icono?: IconType;
  acciones?: ReactNode;
  children: ReactNode;
} & Omit<BoxProps, "title">) {
  return (
    <Box borderWidth="1px" borderColor="border.subtle" rounded="lg" p={{ base: "4", md: "5" }} mb="5" bg="bg.panel" {...rest}>
      <HStack justify="space-between" align="flex-start" gap="3" mb="4" flexWrap="wrap">
        <Box>
          <HStack gap="2">
            {Icono ? (
              <Box as="span" color="brand.600" display="inline-flex">
                <Icono size={18} aria-hidden />
              </Box>
            ) : null}
            <Heading as="h4" size="sm" fontWeight="semibold" color="fg">
              {titulo}
            </Heading>
          </HStack>
          {ayuda ? (
            <Text fontSize="sm" color="fg.muted" mt="1">
              {ayuda}
            </Text>
          ) : null}
        </Box>
        {acciones}
      </HStack>
      {children}
    </Box>
  );
}

type TonoAviso = "alerta" | "peligro" | "info" | "ok";

const ESTILO_AVISO: Record<TonoAviso, { paleta: string; icono: IconType }> = {
  alerta: { paleta: "orange", icono: LuTriangleAlert },
  peligro: { paleta: "red", icono: LuTriangleAlert },
  info: { paleta: "blue", icono: LuInfo },
  ok: { paleta: "green", icono: LuCircleCheck },
};

/** Aviso en caja con ícono: faltantes, leyendas, confirmaciones. */
export function Aviso({
  tono,
  titulo,
  children,
  acciones,
  ...rest
}: {
  tono: TonoAviso;
  titulo?: ReactNode;
  children?: ReactNode;
  acciones?: ReactNode;
} & Omit<StackProps, "title">) {
  const { paleta, icono: Icono } = ESTILO_AVISO[tono];
  return (
    <HStack
      align="flex-start"
      gap="3"
      p="3"
      px="4"
      rounded="md"
      borderWidth="1px"
      borderColor={`${paleta}.200`}
      bg={`${paleta}.50`}
      color={`${paleta}.900`}
      fontSize="sm"
      {...rest}
    >
      <Box as="span" color={`${paleta}.600`} mt="0.5" flexShrink={0} display="inline-flex">
        <Icono size={18} aria-hidden />
      </Box>
      <Box flex="1" minW="0">
        {titulo ? (
          <Text fontWeight="semibold" mb={children ? "0.5" : "0"}>
            {titulo}
          </Text>
        ) : null}
        {children}
      </Box>
      {acciones ? <Box flexShrink={0}>{acciones}</Box> : null}
    </HStack>
  );
}

/** Barra fina de avance ("7 de 10 nutrientes cargados"). */
export function BarraAvance({ valor, total }: { valor: number; total: number }) {
  const porcentaje = total > 0 ? Math.round((valor / total) * 100) : 0;
  const completo = valor >= total;
  return (
    <Box>
      <HStack justify="space-between" fontSize="xs" color="fg.muted" mb="1">
        <Text>Nutrientes cargados</Text>
        <Text fontWeight="semibold" color={completo ? "green.fg" : "fg"}>
          {valor} de {total}
        </Text>
      </HStack>
      <Box h="1.5" bg="bg.muted" rounded="full" overflow="hidden" role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={total}>
        <Box h="100%" w={`${porcentaje}%`} bg={completo ? "green.500" : "brand.500"} rounded="full" transition="width 0.2s" />
      </Box>
    </Box>
  );
}
