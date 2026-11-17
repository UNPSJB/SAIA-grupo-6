import { useMemo } from "react";
import { Box, Grid, GridItem, Heading } from "@chakra-ui/react";
import {
  EstadoCargando,
  EstadoVacio,
  MensajeError,
} from "../../../../components/ui/patrones";
import { useDashboard } from "../../hooks/useDashboard";
import { useInicio } from "../../hooks/useInicio";
import { calcularCumplimiento } from "../../types/dashboard";
import { RequiereAtencion } from "../RequiereAtencion";
import { TarjetaArea } from "../TarjetaArea";
import { TarjetaCumplimiento } from "../TarjetaCumplimiento";

/**
 * Columnas que ocupa cada pieza en la grilla de 12: en pantallas anchas, 3
 * tarjetas de área por fila (4 + 4 + 4) y abajo "Requiere atención" (8,
 * debajo de las dos primeras) y el checklist (4, debajo de la tercera); en
 * tablet, tarjetas de a 2 y lo de abajo a todo el ancho; en el celular, todo
 * a todo el ancho.
 */
const COLUMNAS_AREA = { base: "span 12", md: "span 6", xl: "span 4" };
const COLUMNAS_ATENCION = { base: "span 12", xl: "span 8" };
const COLUMNAS_CHECKLIST = { base: "span 12", xl: "span 4" };

/**
 * Panel principal: cómo está la planta hoy y qué necesita atención.
 *
 * Sin banner propio: cada tarjeta de área lleva el banner de su panel. Todo
 * va en UNA grilla de 12 columnas con el mismo espacio en toda la página,
 * así las tarjetas de arriba y los bloques de abajo quedan alineados por sus
 * bordes. La evolución y el análisis viven en el panel de cada área: acá no
 * se repiten.
 */
export function InicioPage() {
  const { cumplimiento, verOperacion, verIncidentes } = useDashboard();
  const habilitado = verOperacion || verIncidentes;
  const { inicio, loading, error } = useInicio(habilitado);

  const resumen = useMemo(
    () => calcularCumplimiento(cumplimiento.datos.tareas),
    [cumplimiento.datos],
  );

  if (!habilitado) {
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
    // Mismo espacio entre piezas que los paneles de cada área (5 = 20px).
    <Box flex="1" display="flex" flexDirection="column" gap="5">
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

      {loading && <EstadoCargando>Cargando el estado de las áreas...</EstadoCargando>}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && (
        <Grid templateColumns="repeat(12, minmax(0, 1fr))" gap="5" alignItems="start">
          {inicio.areas.map((area) => (
            <GridItem key={area.clave} gridColumn={COLUMNAS_AREA} alignSelf="stretch">
              <TarjetaArea area={area} />
            </GridItem>
          ))}

          <GridItem gridColumn={verOperacion ? COLUMNAS_ATENCION : "span 12"}>
            <RequiereAtencion filas={inicio.atencion} total={inicio.atencion_total} h="auto" />
          </GridItem>

          {verOperacion && (
            <GridItem gridColumn={COLUMNAS_CHECKLIST}>
              <TarjetaCumplimiento
                total={resumen.total}
                completadas={resumen.completadas}
                porcentaje={resumen.porcentaje}
                loading={cumplimiento.loading}
                error={cumplimiento.error}
                h="auto"
              />
            </GridItem>
          )}
        </Grid>
      )}
    </Box>
  );
}
