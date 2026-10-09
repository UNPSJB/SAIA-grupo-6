import { useMemo, useState } from "react";
import { Badge, Box, Flex, HStack, Heading, Spinner, Switch, Text } from "@chakra-ui/react";
import { useResumenIncidentesPorTipo } from "../hooks/useResumenIncidentesPorTipo";
import { TIPOS_INCIDENTE, tipoColor } from "../types/incidente";
import type { TipoIncidente } from "../types/incidente";
import { FONDO_CARD, FONDO_TEAL, TEAL, TEXTO_SUAVE } from "../../../common/theme/tokens";

/** Colores de las barras, en el mismo tono que el badge de cada tipo. */
const COLOR_TIPO: Record<TipoIncidente, string> = {
  plagas: "#e53e3e",
  falla_equipo: "#ed8936",
  devolucion_cliente: "#ecc94b",
  higiene_contaminacion: "#805ad5",
  otro: "#a0aec0",
};

/**
 * Indicador E7: cantidad de incidentes por tipo con barras proporcionales.
 * Por defecto cuenta solo abiertos; el switch agrega los cerrados.
 */
export function IncidentesPorTipoPanel() {
  const [incluirCerrados, setIncluirCerrados] = useState(false);
  const { resumen, loading, error } = useResumenIncidentesPorTipo(incluirCerrados);

  const maxCantidad = useMemo(
    () => Math.max(1, ...resumen.por_tipo.map((t) => t.cantidad)),
    [resumen.por_tipo]
  );

  return (
    <Box
      bg="white"
      p="20px"
      borderRadius="10px"
      boxShadow="0 2px 6px rgba(0,0,0,0.05)"
      mb="25px"
    >
      <HStack justify="space-between" mb="16px" flexWrap="wrap" gap="12px">
        <Box>
          <Heading as="h3" size="sm" fontWeight="bold" color={TEAL}>
            Incidentes por tipo
          </Heading>
          <Text fontSize="13px" color={TEXTO_SUAVE} mt="2px">
            {incluirCerrados
              ? "Total de incidentes (abiertos y cerrados)"
              : "Solo incidentes sin acción correctiva registrada (abiertos)"}
          </Text>
        </Box>
        <Switch.Root
          checked={incluirCerrados}
          onCheckedChange={(e) => setIncluirCerrados(e.checked)}
          colorPalette="teal"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="14px">Incluir cerrados</Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <Flex align="center" gap="8px">
            <Box
              bg={FONDO_TEAL}
              borderRadius="8px"
              px="14px"
              py="8px"
              minW="70px"
              textAlign="center"
            >
              <Text fontSize="24px" fontWeight="bold" color={TEAL} lineHeight="1.1">
                {resumen.total}
              </Text>
            </Box>
            <Text fontSize="13px" color={TEXTO_SUAVE}>
              incidentes {incluirCerrados ? "registrados" : "abiertos"} en total
            </Text>
          </Flex>

          <Box mt="16px">
            {TIPOS_INCIDENTE.map(({ value, label }) => {
              const item = resumen.por_tipo.find((r) => r.tipo === value);
              const cantidad = item?.cantidad ?? 0;
              const ancho = cantidad === 0 ? 0 : Math.max(6, (cantidad / maxCantidad) * 100);
              return (
                <Flex align="center" gap="12px" key={value} mb="10px">
                  <Box width="190px" flexShrink={0}>
                    <Badge colorPalette={tipoColor(value)} borderRadius="md" px="8px" py="2px">
                      {label}
                    </Badge>
                  </Box>
                  <Box
                    flex="1"
                    height="18px"
                    bg={FONDO_CARD}
                    borderRadius="6px"
                    overflow="hidden"
                  >
                    <Box
                      height="18px"
                      bg={COLOR_TIPO[value]}
                      width={`${ancho}%`}
                      borderRadius="6px"
                    />
                  </Box>
                  <Text width="36px" textAlign="right" fontWeight="bold" fontSize="15px">
                    {cantidad}
                  </Text>
                </Flex>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}