import { LuCalendarCheck, LuCircleX } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  textoGranularidad,
  textoPeriodo,
  type PanelLimpieza as DatosLimpieza,
} from "../../types/paneles";
import { GraficoSerie, MapaCalor, Medidor } from "../graficos";
import {
  Bloque,
  GrillaBloques,
  ListaPanel,
  MarcoPanel,
  MetricasBloque,
  VerTodos,
} from "../piezasPanel";

/** Teal de serie de la app: el cumplimiento es LA medida de esta categoría. */
const SERIE_CUMPLIMIENTO = [{ clave: "cumplimiento", etiqueta: "Cumplimiento", color: "#009b8f" }];

/**
 * Panel de Limpieza: cuánto del checklist se cumple, dónde se cumple menos y
 * qué falta reponer. Quien solo opera ve el cumplimiento de las tareas que
 * tiene asignadas, sin el stock de químicos.
 */
export function PanelLimpieza() {
  const panel = usePanel<DatosLimpieza>("limpieza", "sector_id");
  const periodo = textoPeriodo(panel.dias);

  return (
    <MarcoPanel
      panel={panel}
      filtro={{
        label: "Sector",
        todos: "Todos los sectores",
        opciones: panel.datos?.sectores ?? [],
      }}
      aviso={
        panel.datos?.solo_propias
          ? "Estás viendo el cumplimiento de las tareas que tenés asignadas."
          : undefined
      }
    >
      {(d) => (
        <>
          <GrillaBloques principal>
            <Bloque
              titulo="Evolución del cumplimiento"
              descripcion={`Porcentaje de tareas completadas ${textoGranularidad(d.serie_cumplimiento)}`}
              vacio={d.tareas_total === 0 && "No hubo tareas programadas en el período."}
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "hoy",
                      etiqueta: "Pendientes hoy",
                      valor: formatoCantidad(d.pendientes_hoy),
                      icono: LuCalendarCheck,
                      detalle: "Tareas del checklist sin completar",
                    },
                    {
                      clave: "incumplidas",
                      etiqueta: "Incumplidas",
                      valor: formatoCantidad(d.tareas_incumplidas),
                      icono: LuCircleX,
                      detalle: `En los ${periodo}`,
                    },
                  ]}
                />
              }
            >
              <GraficoSerie
                serie={d.serie_cumplimiento}
                series={SERIE_CUMPLIMIENTO}
                tipo="area"
                llenar
                unidad="%"
                resumen="Porcentaje de cumplimiento del checklist por período"
                extraTooltip={(v) =>
                  v.programadas ? `${v.completadas} de ${plural(v.programadas, "tarea", "tareas")}` : null
                }
              />
            </Bloque>

            <Bloque
              titulo="Cumplimiento del período"
              descripcion={`Tareas completadas sobre las programadas en los ${periodo}`}
            >
              <Medidor
                valor={d.cumplimiento}
                detalle={
                  d.cumplimiento === null
                    ? "Sin tareas programadas en el período"
                    : `${d.tareas_completadas} de ${plural(d.tareas_total, "tarea completada", "tareas completadas")}`
                }
              />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Cumplimiento por sector y período"
              descripcion={`Porcentaje de tareas completadas en cada sector, ${textoGranularidad(d.mapa_cumplimiento)}: cuanto más oscuro, más se cumplió`}
              vacio={d.mapa_cumplimiento.filas.length === 0 && "No hay tareas en el período."}
            >
              <MapaCalor
                mapa={d.mapa_cumplimiento}
                color="#009b8f"
                sufijo="%"
                resumen="Porcentaje de cumplimiento por sector y período"
              />
            </Bloque>

            {d.atencion !== null ? (
              <Bloque
                titulo="Químicos y elementos que piden atención"
                descripcion="Stock por debajo del mínimo y recambios vencidos"
                vacio={d.atencion.length === 0 && "No hay químicos ni elementos pendientes."}
              >
                <ListaPanel filas={d.atencion} acento />
                <VerTodos to="/gestion-stock">Ver el stock de químicos</VerTodos>
              </Bloque>
            ) : null}
          </GrillaBloques>
        </>
      )}
    </MarcoPanel>
  );
}
