import { Box, Flex, Grid, Link, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { LuChevronRight } from "react-icons/lu";
import { GRUPOS } from "../../../common/components/menuEntradas";
import { Tarjeta, type TonoEstado } from "../../../components/ui/patrones";
import { formatoCantidad } from "../../../common/utils/numeros";
import type { TarjetaArea as DatosArea } from "../types/paneles";
import { TEMAS_AREA } from "../types/temasArea";
import { ArcosArea } from "./BannerPanel";

/**
 * Color de la cifra según su estado: rojo si hay algo vencido o sin stock, el
 * ámbar de las advertencias de los paneles (no el naranja de "editar") si
 * hay algo por atender, y la tinta del área si está en orden. Sobre los
 * fondos de los seis temas (en sus tres paradas): rojo 5:1 y ámbar 4,5:1
 * como mínimo.
 */
const COLOR_CIFRA: Partial<Record<TonoEstado, string>> = {
  peligro: "red.700",
  alerta: "#8a5a12",
};

/**
 * Estado de hoy de un área en el inicio, con el mismo banner de su panel
 * (degradado, filete de arriba, arcos y tinta del área): se reconoce el área
 * de un vistazo y se anticipa a dónde lleva. Dos cifras en columnas iguales
 * separadas por una línea tenue. Toda la tarjeta lleva a su panel: al pasar
 * el mouse (o con el foco) se eleva apenas.
 */
export function TarjetaArea({ area }: { area: DatosArea }) {
  const tema = TEMAS_AREA[area.clave];
  const Icono = GRUPOS.find((g) => g.id === area.clave)?.icon;
  const pendiente = area.metricas.some((m) => m.tono === "peligro" || m.tono === "alerta");

  return (
    <Link
      asChild
      display="block"
      h="full"
      rounded="lg"
      textDecoration="none"
      _hover={{ textDecoration: "none" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.400", outlineOffset: "2px" }}
      className="group"
    >
      <RouterLink to={area.link}>
        <Tarjeta
          position="relative"
          h="full"
          bg={tema.fondo[1]}
          backgroundImage={`linear-gradient(115deg, ${tema.fondo[0]} 0%, ${tema.fondo[1]} 45%, ${tema.fondo[2]} 100%)`}
          borderColor={tema.borde}
          transition="box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease"
          _groupHover={{ boxShadow: "md", transform: "translateY(-2px)", borderColor: tema.filete[1] }}
          _groupFocusVisible={{ boxShadow: "md", borderColor: tema.filete[1] }}
        >
          <Box h="1" backgroundImage={`linear-gradient(90deg, ${tema.filete.join(", ")})`} aria-hidden />
          <ArcosArea colores={tema.arcos} escala={0.42} />

          <Box position="relative" px="5" pt="4" pb="5">
            <Flex align="center" gap="2.5" mb="5">
              {Icono ? (
                <Flex
                  align="center"
                  justify="center"
                  w="8"
                  h="8"
                  rounded="lg"
                  bg="whiteAlpha.700"
                  color={tema.acento}
                  borderWidth="1px"
                  borderColor={tema.borde}
                  flexShrink={0}
                  aria-hidden
                >
                  <Icono size={16} />
                </Flex>
              ) : null}
              <Text as="h3" fontSize="md" fontWeight="semibold" color={tema.titulo} flex="1" minW="0">
                {area.titulo}
              </Text>
              {!pendiente ? (
                <Text as="span" fontSize="xs" color={tema.bajada}>
                  Al día
                </Text>
              ) : null}
              <Box color={tema.bajada} _groupHover={{ color: tema.acento }} aria-hidden>
                <LuChevronRight size={16} />
              </Box>
            </Flex>

            {/* Dos columnas iguales; la segunda con una línea vertical tenue. */}
            <Grid as="dl" templateColumns="repeat(2, minmax(0, 1fr))" m="0">
              {area.metricas.map((m, i) => (
                <Stack
                  key={m.clave}
                  gap="2"
                  minW="0"
                  {...(i > 0 ? { pl: "5", borderLeftWidth: "1px", borderColor: tema.borde } : { pr: "5" })}
                >
                  <Text
                    as="dd"
                    order={1}
                    m="0"
                    fontSize="3xl"
                    fontWeight="extrabold"
                    lineHeight="1"
                    letterSpacing="-0.02em"
                    color={COLOR_CIFRA[m.tono] ?? tema.titulo}
                    fontVariantNumeric="tabular-nums"
                  >
                    {m.valor === null ? "—" : `${formatoCantidad(m.valor)}${m.unidad ?? ""}`}
                  </Text>
                  <Text as="dt" order={2} fontSize="xs" color={tema.bajada} lineHeight="1.4">
                    {m.etiqueta}
                  </Text>
                </Stack>
              ))}
            </Grid>
          </Box>
        </Tarjeta>
      </RouterLink>
    </Link>
  );
}
