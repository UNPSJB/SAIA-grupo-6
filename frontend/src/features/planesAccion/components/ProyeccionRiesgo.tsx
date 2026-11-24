import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { etiquetaNivel, paletaNivel, type ProyeccionElemento } from "../types/planAccion";
import { Tarjeta } from "../../../components/ui/patrones";

function NivelPuntaje({ nivel, puntaje }: { nivel: string; puntaje: number }) {
  return (
    <HStack gap="2">
      <Badge colorPalette={paletaNivel(nivel)} variant="subtle" rounded="full" px="2">
        {etiquetaNivel(nivel)}
      </Badge>
      <Text as="span" fontSize="sm" color="fg" fontWeight="medium">
        {String(puntaje).replace(".", ",")}
      </Text>
    </HStack>
  );
}

/**
 * Riesgo real de cada elemento hoy y su estimación si el plan resulta eficaz.
 * Es el mejor caso: asume que todas las situaciones del plan se resuelven y
 * dejan de sumar. No cambia el riesgo real, que el motor sigue calculando con
 * lo que ocurre de verdad.
 */
export function ProyeccionRiesgo({
  proyeccion,
  titulo = "Estimado si el plan es eficaz",
}: {
  proyeccion: ProyeccionElemento[];
  titulo?: string;
}) {
  if (proyeccion.length === 0) return null;
  return (
    <Box>
      <Text fontWeight="bold" fontSize="sm" color="fg" mb="1">
        {titulo}
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="3">
        Es el mejor caso: supone que todas las situaciones del plan quedan resueltas y dejan de sumar
        al riesgo del elemento (las resueltas valen 0). El riesgo real no cambia: sigue siendo el
        que calcula el motor. Si el evento reaparece, vuelve a contarse con su recurrencia real.
      </Text>
      <Stack gap="2">
        {proyeccion.map((fila) => (
          <Tarjeta key={fila.elemento} p="3">
            <HStack justify="space-between" gap="3" flexWrap="wrap">
              <Box minW="0" flex="1">
                <Text fontSize="sm" fontWeight="medium" color="fg" lineClamp={1}>
                  {fila.etiqueta}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {fila.situaciones === 1
                    ? "1 situación del plan"
                    : `${fila.situaciones} situaciones del plan`}
                </Text>
              </Box>
              <HStack gap="3">
                <Box>
                  <Text fontSize="2xs" color="fg.subtle">
                    Real hoy
                  </Text>
                  <NivelPuntaje nivel={fila.actual_nivel} puntaje={fila.actual_puntaje} />
                </Box>
                <Box color="fg.muted" aria-label="pasaría a">
                  <LuArrowRight aria-hidden />
                </Box>
                <Box>
                  <Text fontSize="2xs" color="fg.subtle">
                    Estimado
                  </Text>
                  <NivelPuntaje nivel={fila.proyectado_nivel} puntaje={fila.proyectado_puntaje} />
                </Box>
              </HStack>
            </HStack>
          </Tarjeta>
        ))}
      </Stack>
    </Box>
  );
}
