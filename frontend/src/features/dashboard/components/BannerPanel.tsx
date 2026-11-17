import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import type { CategoriaPanel } from "../types/paneles";
import { TEMAS_AREA as TEMAS, type TemaArea } from "../types/temasArea";

interface BannerPanelProps {
  /** Define el tema de color del banner. */
  categoria: CategoriaPanel;
  titulo: string;
  descripcion?: string;
  icono?: IconType;
}

/**
 * Cabecera de los paneles de categoría (`/resumen/:categoria`): reemplaza al
 * `PageHeader` liso con un banner con el color de su área. El título sigue
 * siendo el `h2` de la página (los bloques del panel son `h3`).
 *
 * Sin margen abajo: la barra de filtros del panel se monta sobre su borde
 * inferior (ver `BarraFiltrosPanel`), y por eso el relleno de abajo es mayor.
 *
 * Lo decorativo (los arcos de la derecha) es `aria-hidden` y se oculta en el
 * celular, donde le quitaría ancho al texto.
 */
export function BannerPanel({ categoria, titulo, descripcion, icono: Icono }: BannerPanelProps) {
  const tema = TEMAS[categoria];
  return (
    <Box
      as="header"
      position="relative"
      overflow="hidden"
      rounded="xl"
      bg={tema.fondo[1]}
      backgroundImage={`linear-gradient(115deg, ${tema.fondo[0]} 0%, ${tema.fondo[1]} 45%, ${tema.fondo[2]} 100%)`}
      borderWidth="1px"
      borderColor={tema.borde}
    >
      <Box
        h="1"
        backgroundImage={`linear-gradient(90deg, ${tema.filete.join(", ")})`}
        aria-hidden
      />

      <ArcosArea colores={tema.arcos} />

      <Flex
        position="relative"
        align="center"
        gap={{ base: "4", md: "5" }}
        px={{ base: "5", md: "8" }}
        pt={{ base: "5", md: "7" }}
        // Abajo, lugar para la mitad de la barra de filtros que se apoya encima.
        pb={{ base: "5", md: "9" }}
      >
        {Icono ? (
          <Flex
            flexShrink={0}
            w={{ base: "11", md: "14" }}
            h={{ base: "11", md: "14" }}
            align="center"
            justify="center"
            rounded="xl"
            bg="whiteAlpha.700"
            color={tema.acento}
            borderWidth="1px"
            borderColor={tema.borde}
            boxShadow="panel"
            aria-hidden
          >
            <Icono size={26} />
          </Flex>
        ) : null}
        <Box minW="0" maxW="62ch">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            letterSpacing="0.08em"
            textTransform="uppercase"
            color={tema.acento}
            mb="1"
          >
            Resumen del área
          </Text>
          <Heading as="h2" fontSize="2xl" fontWeight="bold" lineHeight="1.2" color={tema.titulo}>
            {titulo}
          </Heading>
          {descripcion ? (
            <Text mt="1.5" fontSize="sm" color={tema.bajada}>
              {descripcion}
            </Text>
          ) : null}
        </Box>
      </Flex>
    </Box>
  );
}

/**
 * Arcos concéntricos en los tonos del tema, a la derecha: los del banner de
 * los paneles y, más chicos (`escala`), los de las tarjetas de área del
 * inicio. En el celular no se muestran.
 */
export function ArcosArea({ colores, escala = 1 }: { colores: TemaArea["arcos"]; escala?: number }) {
  const [afuera, medio, adentro, centro] = colores;
  return (
    <Box
      position="absolute"
      right={`${-40 * escala}px`}
      top="50%"
      transform={`translateY(-50%) scale(${escala})`}
      transformOrigin="right center"
      display={{ base: "none", md: "block" }}
      pointerEvents="none"
      aria-hidden
    >
      <svg width="320" height="220" viewBox="0 0 320 220" fill="none">
        <circle cx="230" cy="110" r="150" stroke={afuera} strokeOpacity="0.22" strokeWidth="18" />
        <circle cx="230" cy="110" r="108" stroke={medio} strokeOpacity="0.25" strokeWidth="14" />
        <circle cx="230" cy="110" r="70" stroke={adentro} strokeOpacity="0.18" strokeWidth="10" />
        <circle cx="230" cy="110" r="38" fill={centro} fillOpacity="0.55" />
      </svg>
    </Box>
  );
}
