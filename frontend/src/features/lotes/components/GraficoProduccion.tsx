import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "../../../components/ui/tooltip";
import { cantidadConUnidad, formatoCantidad } from "../../../common/utils/numeros";
import type { ProduccionPorProducto } from "../types/lote";

/*
 * Teal validado para gráficos (#009b8f): saturación, contraste y separación
 * para daltonismo verificados con el script del skill de visualización.
 */
const COLOR_BARRA = "#009b8f";
const COLOR_PISTA = "var(--chakra-colors-gray-100)";

interface GraficoProduccionProps {
  datos: ProduccionPorProducto[];
}

/** Agrupa por unidad y ordena cada grupo de mayor a menor. */
function agruparPorUnidad(datos: ProduccionPorProducto[]) {
  const grupos = new Map<string, ProduccionPorProducto[]>();
  for (const punto of datos) {
    const lista = grupos.get(punto.unidad) ?? [];
    lista.push(punto);
    grupos.set(punto.unidad, lista);
  }
  return (
    [...grupos.entries()]
      .map(([unidad, filas]) => ({
        unidad,
        filas: [...filas].sort((a, b) => b.cantidad_producida - a.cantidad_producida),
      }))
      // El grupo con más productos primero.
      .sort((a, b) => b.filas.length - a.filas.length)
  );
}

/**
 * Producción por producto: barras horizontales hechas en HTML, agrupadas por
 * unidad de medida.
 *
 * Por qué así:
 *   - En SVG (Recharts) el nombre del producto era un texto de una línea con
 *     ancho fijo: los largos ("Mermelada de durazno Especial") se cortaban
 *     por la izquierda. En HTML el nombre ocupa hasta dos renglones y se lee
 *     completo; si aun así no entra, termina en "…" y está entero en el
 *     tooltip.
 *   - Cada valor lleva su unidad ("88,281 Kg", "210.066 un").
 *   - Kilos y unidades no se comparan en la misma escala: cada unidad es un
 *     grupo con su propio máximo. Antes "210.066 un" y "88 Kg" compartían
 *     eje y el largo de las barras no se podía comparar.
 *
 * Estilo (pautas de visualización): una sola serie y un color, sin leyenda
 * (el título ya dice qué se mide); barras de 14px redondeadas sobre una pista
 * gris; el valor en la punta; cantidad de lotes en el tooltip.
 */
export function GraficoProduccion({ datos }: GraficoProduccionProps) {
  const grupos = agruparPorUnidad(datos);
  const varios = grupos.length > 1;

  return (
    <Stack gap="5" w="full">
      {grupos.map(({ unidad, filas }) => {
        const maximo = Math.max(...filas.map((f) => f.cantidad_producida), 0);
        return (
          <Box key={unidad} as="section" aria-label={`Producción medida en ${unidad}`}>
            {varios && (
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" mb="2">
                Medido en {unidad}
              </Text>
            )}
            <Stack gap="1" as="ul" listStyleType="none" m="0" p="0">
              {filas.map((fila) => {
                const valor = fila.cantidad_producida;
                const ancho =
                  maximo > 0 ? Math.max((valor / maximo) * 100, valor > 0 ? 1.5 : 0) : 0;
                const lotes = `${formatoCantidad(fila.cantidad_lotes)} ${fila.cantidad_lotes === 1 ? "lote" : "lotes"}`;
                return (
                  <Tooltip
                    key={fila.producto}
                    content={`${fila.producto}: ${cantidadConUnidad(valor, unidad)} en ${lotes}`}
                    positioning={{ placement: "top" }}
                    openDelay={150}
                    closeDelay={0}
                    showArrow
                  >
                    <Grid
                      as="li"
                      tabIndex={0}
                      // En celular el nombre va arriba y la barra debajo, a
                      // todo el ancho: en dos columnas la barra quedaba mínima.
                      templateColumns={{ base: "1fr", sm: "minmax(140px, 32%) 1fr" }}
                      alignItems="center"
                      gap={{ base: "1", sm: "3" }}
                      py="1.5"
                      px="1"
                      rounded="md"
                      _hover={{ bg: "gray.50" }}
                      _focusVisible={{ outline: "2px solid", outlineColor: "brand.400" }}
                    >
                      <Text
                        fontSize="sm"
                        color="fg"
                        textAlign={{ base: "left", sm: "right" }}
                        lineClamp={2}
                        lineHeight="1.25"
                        wordBreak="break-word"
                      >
                        {fila.producto}
                      </Text>
                      <Box display="flex" alignItems="center" gap="3" minW="0">
                        <Box flex="1" h="3.5" bg={COLOR_PISTA} rounded="full" overflow="hidden">
                          <Box
                            h="100%"
                            w={`${ancho}%`}
                            bg={COLOR_BARRA}
                            rounded="full"
                            transition="width 0.4s ease"
                          />
                        </Box>
                        <Text
                          fontSize="sm"
                          fontWeight="semibold"
                          color="fg"
                          whiteSpace="nowrap"
                          fontVariantNumeric="tabular-nums"
                          minW="92px"
                          textAlign="right"
                        >
                          {cantidadConUnidad(valor, unidad)}
                        </Text>
                      </Box>
                    </Grid>
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
