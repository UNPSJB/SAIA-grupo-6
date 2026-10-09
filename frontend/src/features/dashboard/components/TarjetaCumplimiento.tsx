import { Badge, Box, Flex, HStack, Text, type BoxProps } from "@chakra-ui/react";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import { AnilloProgreso } from "./AnilloProgreso";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaCumplimientoProps {
  total: number;
  completadas: number;
  porcentaje: number;
  loading: boolean;
  error: string | null;
}

/**
 * Estado del día según el porcentaje.
 *
 * Una sola tabla decide el color del anillo, el del badge y la frase, para que
 * no puedan contradecirse (un anillo rojo con un "Buen avance"). El color
 * codifica el estado y no decora: verde al día, teal en marcha, ámbar por
 * debajo de la mitad, rojo cuando la carga ya no se levanta.
 */
function estadoDelDia(total: number, porcentaje: number) {
  if (total === 0) {
    return { color: "var(--chakra-colors-brand-500)", paleta: "gray", texto: "Sin tareas" };
  }
  if (porcentaje >= 100) {
    return { color: "var(--chakra-colors-green-500)", paleta: "green", texto: "Todo al día" };
  }
  if (porcentaje >= 50) {
    return { color: "var(--chakra-colors-brand-500)", paleta: "brand", texto: "Buen avance" };
  }
  if (porcentaje >= 25) {
    return { color: "var(--chakra-colors-orange-500)", paleta: "orange", texto: "Con demora" };
  }

  return { color: "var(--chakra-colors-red-500)", paleta: "red", texto: "Muy atrasado" };
}

/**
 * Indicador del día: qué porcentaje de los checklists de hoy está hecho.
 *
 * A la izquierda, el porcentaje grande con el estado del día y el desglose
 * (hechas y pendientes); a la derecha, el anillo con el conteo en el centro.
 * Con `total === 0` no se muestra "0%" sino "—": un plan sin tareas para la
 * fecha no es un día con cero cumplimiento.
 */
export function TarjetaCumplimiento({
  total,
  completadas,
  porcentaje,
  loading,
  error,
  ...rest
}: TarjetaCumplimientoProps & BoxProps) {
  const estado = estadoDelDia(total, porcentaje);
  const pendientes = total - completadas;

  return (
    <TarjetaPanel titulo="Cumplimiento de Checklist" tamanoTitulo="sm" {...rest}>
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && (
        <Flex align="center" gap="4" flex="1" my="auto">
          <Box minW="0">
            {/*
              `4xl` es el token del framework, no un `fontSize="56px"`: la
              escala tipográfica del tema corta en `2xl` y este es el único
              lugar de la app que necesita un número más grande (declarado como
              excepción en `theme/index.ts`).
            */}
            <Text as="p" fontSize="4xl" fontWeight="bold" lineHeight="1" color="brand.fg">
              {total === 0 ? "—" : `${porcentaje}%`}
            </Text>

            <Badge
              mt="2"
              colorPalette={estado.paleta}
              variant="subtle"
              px="2"
              py="0.5"
              borderRadius="full"
              fontSize="xs"
            >
              {estado.texto}
            </Badge>

            <Text mt="2" fontSize="xs" color="fg.muted">
              {total === 0 ? (
                "No hay tareas programadas para hoy."
              ) : (
                <HStack as="span" gap="3" display="inline-flex">
                  <span>Hoy · {completadas} hechas</span>
                  <span>{pendientes} pendientes</span>
                </HStack>
              )}
            </Text>
          </Box>

          <Box w="100px" h="100px" flexShrink={0} ml="auto">
            <AnilloProgreso porcentaje={porcentaje} color={estado.color}>
              {total > 0 && (
                <>
                  <Text fontSize="lg" fontWeight="bold" lineHeight="1" color="fg">
                    {completadas}/{total}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    tareas
                  </Text>
                </>
              )}
            </AnilloProgreso>
          </Box>
        </Flex>
      )}
    </TarjetaPanel>
  );
}
