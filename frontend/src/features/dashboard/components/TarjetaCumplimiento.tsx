import { Box, Flex, HStack, Stack, Text, type BoxProps } from "@chakra-ui/react";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import { AnilloProgreso } from "./AnilloProgreso";
import { EtiquetaEstado, type TonoEstado } from "../../../components/ui/patrones";
import { COLOR_CALIDO } from "../types/coloresGraficos";
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
 * debajo de la mitad (el mismo de las advertencias de los paneles, no el
 * naranja de "editar"), rojo cuando la carga ya no se levanta.
 */
function estadoDelDia(
  total: number,
  porcentaje: number,
): { color: string; tono: TonoEstado | "brand"; texto: string } {
  if (total === 0) {
    return { color: "var(--chakra-colors-brand-500)", tono: "neutro", texto: "Sin tareas" };
  }
  if (porcentaje >= 100) {
    return { color: "var(--chakra-colors-green-500)", tono: "ok", texto: "Todo al día" };
  }
  if (porcentaje >= 50) {
    return { color: "var(--chakra-colors-brand-500)", tono: "brand", texto: "Buen avance" };
  }
  if (porcentaje >= 25) {
    // Ocre de la marca: armoniza con el chip ámbar de al lado.
    return { color: COLOR_CALIDO.ocre, tono: "alerta", texto: "Con demora" };
  }

  return { color: "var(--chakra-colors-red-500)", tono: "peligro", texto: "Muy atrasado" };
}

/** Ámbar de advertencia de los paneles (fondo, borde, texto): ~6:1 de contraste. */
const AMBAR = { fondo: "aviso.ambarFondo", borde: "aviso.ambarBorde", texto: "aviso.ambarTexto" } as const;

/** Etiqueta del estado del día, con los mismos colores que las listas de los paneles. */
function EtiquetaDia({ tono, children }: { tono: TonoEstado | "brand"; children: string }) {
  if (tono === "alerta" || tono === "brand") {
    const ambar = tono === "alerta";
    return (
      <Box
        as="span"
        display="inline-flex"
        px="2.5"
        py="1"
        rounded="full"
        fontSize="xs"
        fontWeight="medium"
        bg={ambar ? AMBAR.fondo : "brand.50"}
        color={ambar ? AMBAR.texto : "brand.800"}
        borderWidth="1px"
        borderColor={ambar ? AMBAR.borde : "brand.200"}
      >
        {children}
      </Box>
    );
  }
  return <EtiquetaEstado tono={tono}>{children}</EtiquetaEstado>;
}

/**
 * Indicador de cumplimiento del día, de extremo a extremo: a la izquierda,
 * el porcentaje grande con el estado del día y, debajo, el desglose (hechas
 * y pendientes) con el color de cada parte del anillo; a la derecha, el
 * anillo con el conteo en el centro. Con `total === 0` no se muestra "0%"
 * sino "—": un plan sin tareas para la fecha no es un día con cero
 * cumplimiento. La evolución del período está en el panel de Limpieza.
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
    <TarjetaPanel
      titulo="Checklist de limpieza de hoy"
      tamanoTitulo="lg"
      descripcion="Tareas del día ya completadas"
      {...rest}
    >
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && (
        // De extremo a extremo: los números a la izquierda y el anillo a la
        // derecha, centrados en altura, sin espacio muerto en el medio.
        <Flex align="center" justify="space-between" gap="4" flex="1" my="auto">
          <Stack gap="2.5" minW="0">
            <HStack gap="3" align="center" flexWrap="wrap">
              {/* Cifra clave: `3xl` extrabold, la misma escala que las
                  métricas de los paneles (ver `theme/index.ts`). */}
              <Text
                as="p"
                fontSize="3xl"
                fontWeight="extrabold"
                lineHeight="1"
                letterSpacing="-0.02em"
                color="fg"
                fontVariantNumeric="tabular-nums"
              >
                {total === 0 ? "—" : `${porcentaje}%`}
              </Text>
              <EtiquetaDia tono={estado.tono}>{estado.texto}</EtiquetaDia>
            </HStack>

            {total === 0 ? (
              <Text fontSize="xs" color="fg.muted">
                No hay tareas programadas para hoy.
              </Text>
            ) : (
              <HStack
                as="dl"
                gap="4"
                fontSize="xs"
                color="fg.muted"
                fontVariantNumeric="tabular-nums"
                flexWrap="wrap"
              >
                <HStack gap="1.5">
                  <Box w="2" h="2" rounded="full" bg={estado.color} aria-hidden />
                  <Text as="dd" fontWeight="semibold" color="fg">
                    {completadas}
                  </Text>
                  <Text as="dt">{completadas === 1 ? "hecha" : "hechas"}</Text>
                </HStack>
                <HStack gap="1.5">
                  <Box w="2" h="2" rounded="full" bg="border.emphasized" aria-hidden />
                  <Text as="dd" fontWeight="semibold" color="fg">
                    {pendientes}
                  </Text>
                  <Text as="dt">{pendientes === 1 ? "pendiente" : "pendientes"}</Text>
                </HStack>
              </HStack>
            )}
          </Stack>

          <Box w="96px" h="96px" flexShrink={0}>
            <AnilloProgreso porcentaje={porcentaje} color={estado.color}>
              {total > 0 && (
                <>
                  <Text fontSize="md" fontWeight="bold" lineHeight="1" color="fg">
                    {completadas}/{total}
                  </Text>
                  <Text fontSize="xs" color="fg.muted" mt="0.5">
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
