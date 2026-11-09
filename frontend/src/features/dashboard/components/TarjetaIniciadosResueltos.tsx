import { Stack, type BoxProps } from "@chakra-ui/react";
import { EstadoCargando, MensajeError } from "../../../components/ui/patrones";
import {
  agrupacionPara,
  errorDeRangoFechas,
  type PuntoSerie,
  type RangoFechas,
} from "../types/dashboard";
import { SelectorRango } from "./SelectorRango";
import { GraficoBarras } from "./GraficoBarras";
import { TarjetaPanel } from "./TarjetaPanel";

interface TarjetaIniciadosResueltosProps {
  datos: PuntoSerie[];
  loading: boolean;
  error: string | null;
  rango: RangoFechas;
  onCambiarRango: (rango: RangoFechas) => void;
}

const TEXTO_AGRUPACION = {
  dia: "Por día",
  semana: "Por semana",
  mes: "Por mes",
} as const;

/**
 * Incidentes iniciados contra resueltos en el período elegido.
 *
 * Antes estaba fijo en las cuatro semanas del mes en curso. Ahora tiene su
 * "Desde / Hasta" como Producción, y la serie se agrupa por día, semana o mes
 * según el largo del período (`agrupacionPara`); el subtítulo lo dice.
 */
export function TarjetaIniciadosResueltos({
  datos,
  loading,
  error,
  rango,
  onCambiarRango,
  ...rest
}: TarjetaIniciadosResueltosProps & BoxProps) {
  const errorRango = errorDeRangoFechas(rango);
  return (
    <TarjetaPanel
      titulo="Incidentes Iniciados vs Resueltos"
      descripcion={errorRango ? undefined : `${TEXTO_AGRUPACION[agrupacionPara(rango)]}, en el período seleccionado`}
      acciones={
        <SelectorRango
          desde={rango.desde}
          hasta={rango.hasta}
          onCambio={(desde, hasta) => onCambiarRango({ desde, hasta })}
        />
      }
      {...rest}
    >
      {loading && <EstadoCargando />}

      {!loading && (error || errorRango) && <MensajeError>{error ?? errorRango}</MensajeError>}

      {!loading && !error && !errorRango && (
        <Stack gap="2" flex="1">
          <GraficoBarras datos={datos} />
        </Stack>
      )}
    </TarjetaPanel>
  );
}
