import { Stack, Text, type BoxProps } from "@chakra-ui/react";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import type { PuntoSerie } from "../types/dashboard";
import { GraficoBarras } from "./GraficoBarras";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaIniciadosResueltosProps {
  datos: PuntoSerie[];
  loading: boolean;
  error: string | null;
}

/**
 * Incidentes iniciados contra resueltos, semana a semana.
 *
 * El subtítulo dice el período que abarca la serie, porque "Iniciados vs
 * resueltos" sin ventana temporal no significa nada: son las semanas del mes
 * en curso.
 */
export function TarjetaIniciadosResueltos({
  datos,
  loading,
  error,
  ...rest
}: TarjetaIniciadosResueltosProps & BoxProps) {
  return (
    <TarjetaPanel titulo="Incidentes Iniciados vs Resueltos" {...rest}>
      {loading && <EstadoCargando />}

      {!loading && error && <MensajeError>{error}</MensajeError>}

      {!loading && !error && (
        <Stack gap="2" flex="1" my="auto">
          <Text fontSize="xs" color="fg.subtle">
            {datos.length === 0
              ? "Sin semanas para comparar."
              : "Comparación del mes actual"}
          </Text>
          <GraficoBarras datos={datos} />
        </Stack>
      )}
    </TarjetaPanel>
  );
}
