import { LuCalendarX, LuTriangleAlert } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  textoGranularidad,
  textoPeriodo,
  type PanelEquipos as DatosEquipos,
} from "../../types/paneles";
import { GraficoSerie } from "../graficos";
import { COLOR_SERIE, serieVacia } from "../../types/coloresGraficos";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  MarcoPanel,
  MetricasBloque,
  VerTodos,
} from "../piezasPanel";

const SERIES_INCIDENTES = [
  { clave: "reportados", etiqueta: "Reportados", color: COLOR_SERIE.naranja },
  { clave: "cerrados", etiqueta: "Cerrados", color: COLOR_SERIE.aqua },
];

/**
 * Panel de Equipos: cuántos incidentes se reportan y se cierran, y qué
 * equipos son los que más problemas dan.
 */
export function PanelEquipos() {
  const panel = usePanel<DatosEquipos>("equipos", "sector_id");
  const periodo = textoPeriodo(panel.dias);

  return (
    <MarcoPanel
      panel={panel}
      filtro={{
        label: "Sector",
        todos: "Todos los sectores",
        opciones: panel.datos?.sectores ?? [],
      }}
    >
      {(d) => (
        <GrillaBloques principal>
          <Bloque
            titulo="Incidentes de equipos"
            descripcion={`Reportados y cerrados ${textoGranularidad(d.serie_incidentes)}`}
            vacio={
              serieVacia(d.serie_incidentes, ["reportados", "cerrados"]) &&
              "No hubo incidentes de equipos en el período."
            }
            acciones={
              <MetricasBloque
                enCabecera
                metricas={[
                  {
                    clave: "abiertos",
                    etiqueta: "Incidentes abiertos",
                    valor: formatoCantidad(d.incidentes_abiertos),
                    icono: LuTriangleAlert,
                    detalle: `En ${plural(d.equipos_con_incidentes_abiertos, "equipo", "equipos")} de ${formatoCantidad(d.equipos_activos)} activos`,
                  },
                  {
                    clave: "planes",
                    etiqueta: "Planes vencidos",
                    valor: formatoCantidad(d.planes_vencidos),
                    icono: LuCalendarX,
                    detalle: `${plural(d.planes_proximos, "próximo", "próximos")} a vencer · ${plural(d.equipos_sin_plan, "equipo", "equipos")} sin plan`,
                  },
                ]}
              />
            }
          >
            <GraficoSerie
              serie={d.serie_incidentes}
              series={SERIES_INCIDENTES}
              resumen="Incidentes de equipos reportados y cerrados por período"
              llenar
            />
          </Bloque>

          <Bloque
            titulo="Equipos con más incidentes"
            descripcion={`Incidentes reportados en los ${periodo}`}
            vacio={
              d.equipos_mas_incidentes.length === 0 && "Ningún equipo tuvo incidentes en el período."
            }
          >
            <BarrasHorizontales datos={d.equipos_mas_incidentes} mostrar="detalle" />
            <VerTodos to="/incidentes">Ver los incidentes</VerTodos>
          </Bloque>
        </GrillaBloques>
      )}
    </MarcoPanel>
  );
}
