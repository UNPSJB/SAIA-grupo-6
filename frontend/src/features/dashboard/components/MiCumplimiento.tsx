import { Box, HStack, Text } from "@chakra-ui/react";
import { BannerError, EstadoCargando, FormNativeSelect } from "../../../components/ui/patrones";
import { usePanel } from "../hooks/usePanel";
import {
  PERIODOS,
  plural,
  textoGranularidad,
  textoPeriodo,
  type PanelLimpieza as DatosLimpieza,
} from "../types/paneles";
import { GraficoSerie } from "./graficos";
import { TarjetaPanel } from "./TarjetaPanel";

const SERIE_CUMPLIMIENTO = [{ clave: "cumplimiento", etiqueta: "Cumplimiento", color: "#009b8f" }];

/**
 * Inicio de quien solo opera: cuánto cumplió de las tareas de limpieza que
 * tiene asignadas, a lo largo del período. Es lo único de los paneles que ve
 * (el backend ya recorta el panel de limpieza a sus tareas); el resto de los
 * indicadores es del tablero de administración.
 */
export function MiCumplimiento() {
  const panel = usePanel<DatosLimpieza>("limpieza");
  const d = panel.datos;

  return (
    <TarjetaPanel
      titulo="Mi cumplimiento"
      descripcion={
        d
          ? `Tareas de limpieza que tenés asignadas, completadas ${textoGranularidad(d.serie_cumplimiento)}`
          : "Tareas de limpieza que tenés asignadas"
      }
      acciones={
        <Box w="180px">
          <FormNativeSelect
            value={panel.dias}
            onChange={(e) => panel.cambiarDias(e.target.value)}
            aria-label="Período"
          >
            {PERIODOS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </FormNativeSelect>
        </Box>
      }
    >
      {panel.error && <BannerError>{panel.error}</BannerError>}
      {!d && panel.loading && <EstadoCargando>Cargando tu cumplimiento...</EstadoCargando>}
      {d && (
        <>
          <HStack gap="6" mb="4" flexWrap="wrap">
            <Box>
              <Text fontSize="3xl" fontWeight="bold" lineHeight="1">
                {d.cumplimiento === null ? "—" : `${Math.round(d.cumplimiento)}%`}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {d.cumplimiento === null
                  ? `Sin tareas asignadas en los ${textoPeriodo(panel.dias)}`
                  : `${d.tareas_completadas} de ${plural(d.tareas_total, "tarea", "tareas")} en los ${textoPeriodo(panel.dias)}`}
              </Text>
            </Box>
            <Box>
              <Text fontSize="3xl" fontWeight="bold" lineHeight="1">
                {d.pendientes_hoy}
              </Text>
              <Text fontSize="sm" color="fg.muted">Pendientes hoy</Text>
            </Box>
          </HStack>
          {d.tareas_total === 0 ? (
            <Text fontSize="sm" color="fg.muted">No tuviste tareas asignadas en el período.</Text>
          ) : (
            <GraficoSerie
              serie={d.serie_cumplimiento}
              series={SERIE_CUMPLIMIENTO}
              tipo="area"
              llenar
              fechasEnDiagonal={false}
              unidad="%"
              resumen="Porcentaje de cumplimiento de mis tareas por período"
              extraTooltip={(v) =>
                v.programadas ? `${v.completadas} de ${plural(v.programadas, "tarea", "tareas")}` : null
              }
            />
          )}
        </>
      )}
    </TarjetaPanel>
  );
}
