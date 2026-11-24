import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import type { CategoriaPanel } from "../types/paneles";
import { TEMAS_AREA as TEMAS, type TemaArea } from "../types/temasArea";

interface BannerPanelProps {
  /** Define el tema de color del banner (o `tema`, para uno que no es un área). */
  categoria?: CategoriaPanel;
  tema?: TemaArea;
  /** Etiqueta chica arriba del título. */
  etiqueta?: string;
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
export function BannerPanel({
  categoria,
  tema: temaPropio,
  etiqueta = "Resumen del área",
  titulo,
  descripcion,
  icono: Icono,
}: BannerPanelProps) {
  const tema = temaPropio ?? TEMAS[categoria ?? "produccion"];
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
            w={{ base: "12", md: "16" }}
            h={{ base: "12", md: "16" }}
            align="center"
            justify="center"
            color={tema.acento}
            aria-hidden
          >
            <Box as="span" display="contents" fontSize={{ base: "40px", md: "52px" }}>
              <Icono size="1em" />
            </Box>
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
            {etiqueta}
          </Text>
          <Heading as="h2" fontSize={{ base: "3xl", md: "4xl" }} fontWeight="bold" lineHeight="1.1" color={tema.titulo}>
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
        <circle cx="230" cy="110" r="150" style={{ stroke: afuera }} strokeOpacity="0.22" strokeWidth="18" />
        <circle cx="230" cy="110" r="108" style={{ stroke: medio }} strokeOpacity="0.25" strokeWidth="14" />
        <circle cx="230" cy="110" r="70" style={{ stroke: adentro }} strokeOpacity="0.18" strokeWidth="10" />
        <circle cx="230" cy="110" r="38" style={{ fill: centro }} fillOpacity="0.55" />
      </svg>
    </Box>
  );
}
