import { useMemo } from "react";
import { Badge, Box, Flex, HStack, Heading, Spinner, Switch, Text } from "@chakra-ui/react";
import { Tooltip } from "../../../components/ui/tooltip";
import { useResumenIncidentesPorTipo } from "../hooks/useResumenIncidentesPorTipo";
import { TIPOS_INCIDENTE, tipoColor } from "../types/incidente";
import type { TipoIncidente } from "../types/incidente";
import { Tarjeta } from "../../../components/ui/patrones";

/** Colores de las barras, en el mismo tono que el badge de cada tipo. */
const COLOR_TIPO: Record<TipoIncidente, string> = {
  plagas: "#e53e3e",
  falla_equipo: "#ed8936",
  devolucion_cliente: "#ecc94b",
  higiene_contaminacion: "#805ad5",
  otro: "#a0aec0",
};

interface IncidentesPorTipoPanelProps {
  filtroTipo: TipoIncidente | "";
  onFiltroTipoChange: (tipo: TipoIncidente | "") => void;
  incluirCerrados: boolean;
  onIncluirCerradosChange: (checked: boolean) => void;
}

/**
 * Indicador E7: cantidad de incidentes por tipo con barras proporcionales.
 * Por defecto cuenta solo abiertos; el switch agrega los cerrados.
 * Las barras son clickeables y filtran la tabla de incidentes.
 */
export function IncidentesPorTipoPanel({ filtroTipo, onFiltroTipoChange, incluirCerrados, onIncluirCerradosChange }: IncidentesPorTipoPanelProps) {
  const { resumen, loading, error } = useResumenIncidentesPorTipo(incluirCerrados);

  const maxCantidad = useMemo(
    () => Math.max(1, ...resumen.por_tipo.map((t) => t.cantidad)),
    [resumen.por_tipo]
  );

  const handleBarraClick = (tipo: TipoIncidente) => {
    if (cantidadTipo(tipo) === 0) return;
    onFiltroTipoChange(filtroTipo === tipo ? "" : tipo);
  };

  const cantidadTipo = (tipo: TipoIncidente) =>
    resumen.por_tipo.find((r) => r.tipo === tipo)?.cantidad ?? 0;

  return (
    <Tarjeta p="5" mb="6">
      <HStack justify="space-between" mb="4" flexWrap="wrap" gap="3">
        <Box>
          <Heading as="h3" size="sm" fontWeight="bold" color="brand.fg">
            Incidentes por tipo
          </Heading>
          <Text fontSize="sm" color="fg.muted" mt="1">
            {incluirCerrados
              ? "Total de incidentes (abiertos y cerrados)"
              : "Solo incidentes sin acción correctiva registrada (abiertos)"}
          </Text>
        </Box>
        <Switch.Root
          checked={incluirCerrados}
          onCheckedChange={(e) => onIncluirCerradosChange(e.checked)}
          colorPalette="teal"
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Incluir cerrados</Switch.Label>
        </Switch.Root>
      </HStack>

      {loading && <Spinner />}
      {!loading && error && <Text color="red.500">{error}</Text>}

      {!loading && !error && (
        <>
          <Flex align="center" gap="3" mb="4">
            <Box
              bg="brand.50"
              borderRadius="md"
              px="4"
              py="2"
              minW="60px"
              textAlign="center"
            >
              <Text fontSize="xl" fontWeight="bold" color="brand.fg" lineHeight="1.2">
                {resumen.total}
              </Text>
            </Box>
            <Text fontSize="sm" color="fg.muted">
              incidentes {incluirCerrados ? "registrados" : "abiertos"} en total
            </Text>
          </Flex>

          <Box>
            {TIPOS_INCIDENTE.map(({ value, label }) => {
              const cantidad = cantidadTipo(value);
              const ancho = cantidad === 0 ? 0 : Math.max(6, (cantidad / maxCantidad) * 100);
              const estaSeleccionado = filtroTipo === value;
              const tieneIncidentes = cantidad > 0;
              const estaAtenuado = filtroTipo !== "" && !estaSeleccionado;

              const badgeContent = (
                <Badge
                  colorPalette={tipoColor(value)}
                  borderRadius="md"
                  px="3"
                  py="1"
                  fontWeight={estaSeleccionado ? "bold" : "normal"}
                  outline={estaSeleccionado ? "2px solid" : "none"}
                  outlineColor={COLOR_TIPO[value]}
                  opacity={cantidad === 0 ? 0.5 : estaAtenuado ? 0.4 : 1}
                >
                  {label}
                </Badge>
              );

              const barra = (
                <Box
                  flex="1"
                  height="6"
                  bg="bg.subtle"
                  borderRadius="full"
                  overflow="hidden"
                  cursor={tieneIncidentes ? "pointer" : "default"}
                  onClick={() => handleBarraClick(value)}
                  opacity={estaSeleccionado ? 1 : cantidad === 0 ? 0.4 : estaAtenuado ? 0.3 : 0.85}
                  _hover={tieneIncidentes && !estaSeleccionado ? { opacity: 1 } : {}}
                >
                  <Box
                    height="6"
                    bg={COLOR_TIPO[value]}
                    width={`${ancho}%`}
                    borderRadius="full"
                  />
                </Box>
              );

              return (
                <Flex align="center" gap="3" key={value} mb="3">
                  <Box width="180px" flexShrink="0">
                    <Tooltip
                      content={`Filtrar por ${label}`}
                      disabled={!tieneIncidentes}
                    >
                      {badgeContent}
                    </Tooltip>
                  </Box>

                  <Tooltip
                    content={
                      cantidad === 0
                        ? `${label}: sin incidentes`
                        : `${label}: ${cantidad} incidente${cantidad !== 1 ? "s" : ""} (${incluirCerrados ? "abiertos + cerrados" : "abiertos"})`
                    }
                    disabled={!tieneIncidentes}
                  >
                    {barra}
                  </Tooltip>

                  <Text
                    width="8"
                    textAlign="right"
                    fontWeight={estaSeleccionado ? "bold" : "normal"}
                    fontSize="sm"
                    color={estaSeleccionado ? COLOR_TIPO[value] : undefined}
                    opacity={cantidad === 0 ? 0.5 : estaAtenuado ? 0.4 : 1}
                  >
                    {cantidad}
                  </Text>
                </Flex>
              );
            })}
          </Box>
        </>
      )}
    </Tarjeta>
  );
}
