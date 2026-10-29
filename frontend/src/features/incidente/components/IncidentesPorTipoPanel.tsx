import { useMemo } from "react";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  HStack,
  Heading,
  Spinner,
  Switch,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "../../../components/ui/tooltip";
import { useResumenIncidentesPorTipo } from "../hooks/useResumenIncidentesPorTipo";
import { TIPOS_INCIDENTE, ETIQUETA_PERIODO, tipoColor, periodoLabel } from "../types/incidente";
import type { PeriodoRapido, TipoIncidente } from "../types/incidente";
import {
  FormInput,
  LabelFiltro,
  Tarjeta,
} from "../../../components/ui/patrones";
import { formatoFecha } from "../../../common/utils/fechas";

/** Colores de las barras, en el mismo tono que el badge de cada tipo. */
const COLOR_TIPO: Record<TipoIncidente, string> = {
  plagas: "#e53e3e",
  falla_equipo: "#ed8936",
  devolucion_cliente: "#ecc94b",
  higiene_contaminacion: "#805ad5",
  otro: "#a0aec0",
};

/** Períodos rápidos, en el orden en que se muestran los chips. */
const PERIODOS_RAPIDOS: { value: PeriodoRapido; label: string }[] = (
  ["7d", "30d", "mes", "todo"] as const
).map((valor) => ({ value: valor, label: ETIQUETA_PERIODO[valor] }));

interface IncidentesPorTipoPanelProps {
  filtroTipo: TipoIncidente | "";
  onFiltroTipoChange: (tipo: TipoIncidente | "") => void;
  incluirCerrados: boolean;
  onIncluirCerradosChange: (checked: boolean) => void;
  periodo: PeriodoRapido;
  onPeriodoChange: (periodo: PeriodoRapido) => void;
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesdeChange: (valor: string) => void;
  onFechaHastaChange: (valor: string) => void;
}

/**
 * Chip de período. Está FUERA del componente que lo usa a propósito: si se
 * definiera adentro, React vería un tipo de componente nuevo en cada render
 * y remontaría los controles mientras se escribe.
 */
function ChipPeriodo({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={isActive ? "solid" : "outline"}
      colorPalette={isActive ? "brand" : "neutral"}
      fontWeight="bold"
      fontSize="sm"
      rounded="full"
      size="sm"
    >
      {label}
    </Button>
  );
}

/**
 * Indicador E7: cantidad de incidentes por tipo con barras proporcionales.
 * Por defecto cuenta solo abiertos; el switch agrega los cerrados.
 * Las barras son clickeables y filtran la tabla de incidentes.
 */
export function IncidentesPorTipoPanel({
  filtroTipo,
  onFiltroTipoChange,
  incluirCerrados,
  onIncluirCerradosChange,
  periodo,
  onPeriodoChange,
  fechaDesde,
  fechaHasta,
  onFechaDesdeChange,
  onFechaHastaChange,
}: IncidentesPorTipoPanelProps) {
  // Con período "todo" no se mandan fechas: el backend cuenta el histórico
  // completo y se mantiene el comportamiento original.
  const { resumen, loading, error } = useResumenIncidentesPorTipo(
    incluirCerrados,
    periodo === "todo" ? undefined : fechaDesde,
    periodo === "todo" ? undefined : fechaHasta
  );

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

  const universo = incluirCerrados
    ? "Total de incidentes (abiertos y cerrados)"
    : "Solo incidentes sin acción correctiva registrada (abiertos)";

  return (
    <Tarjeta p="5" mb="6">
      <HStack justify="space-between" mb="4" flexWrap="wrap" gap="3">
        <Box>
          <Heading as="h3" size="sm" fontWeight="bold" color="brand.fg">
            Incidentes por tipo
          </Heading>
          <Text fontSize="sm" color="fg.muted" mt="1">
            {universo} ·{" "}
            {periodo === "personalizado"
              ? `${formatoFecha(fechaDesde)} – ${formatoFecha(fechaHasta)}`
              : periodoLabel(periodo)}
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

      {/* Selector de período: chips rápidos + rango personalizado */}
      <Flex align="center" gap="2" flexWrap="wrap" mb="4">
        {PERIODOS_RAPIDOS.map(({ value, label }) => (
          <ChipPeriodo
            key={value}
            label={label}
            isActive={periodo === value}
            onClick={() => onPeriodoChange(value)}
          />
        ))}
        <ChipPeriodo
          label={ETIQUETA_PERIODO.personalizado}
          isActive={periodo === "personalizado"}
          onClick={() => onPeriodoChange("personalizado")}
        />

        {periodo === "personalizado" && (
          <HStack gap="3" flexWrap="wrap" align="flex-end">
            <Box>
              <Field.Root>
                <LabelFiltro>Desde</LabelFiltro>
                <FormInput
                  type="date"
                  value={fechaDesde}
                  max={fechaHasta}
                  onChange={(e) => onFechaDesdeChange(e.target.value)}
                  w="auto"
                />
              </Field.Root>
            </Box>
            <Box>
              <Field.Root>
                <LabelFiltro>Hasta</LabelFiltro>
                <FormInput
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde}
                  onChange={(e) => onFechaHastaChange(e.target.value)}
                  w="auto"
                />
              </Field.Root>
            </Box>
          </HStack>
        )}
      </Flex>

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
