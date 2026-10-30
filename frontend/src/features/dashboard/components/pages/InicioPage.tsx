import { useMemo } from "react";
import { Box, Flex, Grid, Heading } from "@chakra-ui/react";
import {
  EstadoVacio,
} from "../../../../components/ui/patrones";
import { useDashboard } from "../../hooks/useDashboard";
import {
  calcularCumplimiento,
  calcularEquiposCalibrados,
  incidentesPorSemana,
  partesPorTipo,
} from "../../types/dashboard";
import { GraficoTorta } from "../GraficoTorta";
import { TarjetaCumplimiento } from "../TarjetaCumplimiento";
import { TarjetaEquiposCalibrados } from "../TarjetaEquiposCalibrados";
import { TarjetaIniciadosResueltos } from "../TarjetaIniciadosResueltos";

/**
 * Panel principal.
 *
 * Reúne indicadores y estadísticas generales. Las notificaciones y la gestión
 * de criticidad se encuentran en su pantalla específica y no se cargan acá.
 */
export function InicioPage() {
  const {
    cumplimiento,
    incidentes,
    calibracion,
    verOperacion,
    verIncidentes,
  } = useDashboard();

  const resumen = useMemo(
    () => calcularCumplimiento(cumplimiento.datos.tareas),
    [cumplimiento.datos],
  );

  const partes = useMemo(
    () => partesPorTipo(incidentes.datos),
    [incidentes.datos],
  );

  const estadoCalibracion = useMemo(
    () =>
      calcularEquiposCalibrados(
        calibracion.datos.equipos,
        calibracion.datos.planes,
      ),
    [calibracion.datos],
  );

  const serie = useMemo(
    () => incidentesPorSemana(incidentes.datos),
    [incidentes.datos],
  );

  if (!verOperacion && !verIncidentes) {
    return (
      <Box flex="1" display="flex" flexDirection="column">
        <EstadoVacio>
          Tu usuario no tiene permisos habilitados para ver el panel. Comunicate
          con un administrador.
        </EstadoVacio>
      </Box>
    );
  }

  return (
    <Box flex="1" display="flex" flexDirection="column">
      <Heading
        as="h2"
        position="absolute"
        w="1px"
        h="1px"
        m="-1px"
        p="0"
        overflow="hidden"
        clipPath="inset(50%)"
        whiteSpace="nowrap"
      >
        Panel principal
      </Heading>

      <Grid
        templateColumns={{
          base: "1fr",
          xl: verIncidentes ? "minmax(0, 3fr) minmax(0, 2fr)" : "1fr",
        }}
        templateRows={{ xl: "1fr" }}
        gap="6"
        flex="1"
      >
        <Flex direction="column" gap="6" minW="0">
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
            gap="6"
          >
            {verOperacion && (
              <TarjetaCumplimiento
                total={resumen.total}
                completadas={resumen.completadas}
                porcentaje={resumen.porcentaje}
                loading={cumplimiento.loading}
                error={cumplimiento.error}
              />
            )}

            {verIncidentes && (
              <TarjetaEquiposCalibrados
                estado={estadoCalibracion}
                loading={calibracion.loading}
                error={calibracion.error}
              />
            )}
          </Grid>
        </Flex>

        {verIncidentes && (
          <Flex direction="column" gap="6" minW="0">
            <GraficoTorta
              partes={partes}
              loading={incidentes.loading}
              error={incidentes.error}
              h="auto"
              flexShrink={0}
            />

            <TarjetaIniciadosResueltos
              datos={serie}
              loading={incidentes.loading}
              error={incidentes.error}
              flex="1"
              h="auto"
            />
          </Flex>
        )}
      </Grid>
    </Box>
  );
}
