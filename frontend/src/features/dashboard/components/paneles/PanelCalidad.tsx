import { LuCircleCheckBig, LuMessageSquareWarning, LuTimer } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import {
  plural,
  sinValores,
  textoGranularidad,
  textoPeriodo,
  type PanelCalidad as DatosCalidad,
} from "../../types/paneles";
import { GraficoDona, GraficoSerie, MapaCalor } from "../graficos";
import { COLOR_ESTADO, COLOR_SERIE, conColor, serieVacia } from "../../types/coloresGraficos";
import { partesDeConteos } from "../../types/dashboard";
import { AnilloIncidentes } from "../AnilloIncidentes";
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

/** Cuanto más viejo el incidente abierto, más grave: es un semáforo. */
const COLOR_ANTIGUEDAD = {
  semana: COLOR_ESTADO.ok,
  mes: COLOR_ESTADO.alerta,
  mas: COLOR_ESTADO.peligro,
};

/**
 * Panel de Calidad: si los incidentes se resuelven al ritmo que entran, de
 * qué tipo son y de qué se quejan los clientes.
 *
 * Quien solo opera ve únicamente los incidentes que reportó (es lo que el
 * sistema le deja consultar). El filtro por tipo aplica a los incidentes, no
 * a los reclamos.
 */
export function PanelCalidad() {
  const panel = usePanel<DatosCalidad>("calidad", "tipo");
  const periodo = textoPeriodo(panel.dias);

  return (
    <MarcoPanel
      panel={panel}
      filtro={{
        label: "Tipo de incidente",
        todos: "Todos los tipos",
        opciones: panel.datos?.tipos ?? [],
      }}
      aviso={
        panel.datos?.solo_propios
          ? "Estás viendo solo los incidentes que reportaste."
          : undefined
      }
    >
      {(d) => (
        <>
          <GrillaBloques principal>
            <Bloque
              titulo="Incidentes reportados y cerrados"
              descripcion={`Evolución ${textoGranularidad(d.serie_incidentes)}: si se cierran al ritmo que entran`}
              vacio={
                serieVacia(d.serie_incidentes, ["reportados", "cerrados"]) &&
                "No hubo incidentes en el período."
              }
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "resueltos",
                      etiqueta: "Resueltos",
                      valor:
                        d.porcentaje_resuelto === null
                          ? null
                          : `${Math.round(d.porcentaje_resuelto)}%`,
                      icono: LuCircleCheckBig,
                      avance: d.porcentaje_resuelto,
                      detalle: `${formatoCantidad(d.incidentes_resueltos)} de ${plural(d.incidentes_reportados, "reportado", "reportados")}`,
                    },
                    {
                      clave: "resolucion",
                      etiqueta: "Tiempo de resolución",
                      valor:
                        d.dias_resolucion === null
                          ? null
                          : `${formatoCantidad(d.dias_resolucion)} d`,
                      icono: LuTimer,
                      detalle:
                        d.dias_resolucion === null
                          ? "No se cerró ninguno en el período"
                          : `Promedio de ${plural(d.cerrados_periodo, "cerrado", "cerrados")}`,
                    },
                  ]}
                />
              }
            >
              <GraficoSerie
                serie={d.serie_incidentes}
                series={SERIES_INCIDENTES}
                tipo="area"
                llenar
                resumen="Incidentes reportados y cerrados por período"
              />
            </Bloque>

            <Bloque
              titulo="Antigüedad de los abiertos"
              descripcion="Cuánto llevan sin cerrarse los incidentes abiertos hoy"
              vacio={sinValores(d.antiguedad_abiertos) && "No hay incidentes abiertos."}
            >
              <GraficoDona
                partes={conColor(d.antiguedad_abiertos, COLOR_ANTIGUEDAD)}
                unidad="abiertos"
              />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques principal>
            <Bloque
              titulo="Incidentes por tipo y período"
              descripcion={`Reportados de cada tipo, ${textoGranularidad(d.mapa_incidentes)}: cuanto más oscuro, más incidentes`}
              vacio={d.mapa_incidentes.filas.length === 0 && "No se reportaron incidentes en el período."}
            >
              <MapaCalor
                mapa={d.mapa_incidentes}
                color={COLOR_SERIE.naranja}
                unidad="incidentes"
                resumen="Incidentes reportados por tipo y período"
              />
            </Bloque>

            <Bloque
              titulo="Incidentes por categoría"
              descripcion={`Reportados en los ${periodo}, por tipo`}
              vacio={d.incidentes_por_tipo.length === 0 && "No se reportaron incidentes en el período."}
            >
              <AnilloIncidentes partes={partesDeConteos(d.incidentes_por_tipo)} />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Principales motivos de reclamo"
              descripcion={`Reclamos de clientes registrados en los ${periodo}`}
              vacio={d.motivos_reclamo.length === 0 && "No hubo reclamos en el período."}
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "reclamos",
                      etiqueta: "Reclamos",
                      valor: formatoCantidad(d.reclamos),
                      icono: LuMessageSquareWarning,
                      detalle: `${plural(d.reclamos_fuera_de_plazo, "fuera de plazo", "fuera de plazo")}`,
                    },
                  ]}
                />
              }
            >
              <BarrasHorizontales datos={d.motivos_reclamo} unidad="reclamos" />
              <VerTodos to="/reclamos">Ver los reclamos</VerTodos>
            </Bloque>

            <Bloque
              titulo="Productos con más reclamos"
              descripcion="Dónde se repiten los problemas"
              vacio={d.productos_con_reclamos.length === 0 && "No hubo reclamos en el período."}
            >
              <BarrasHorizontales datos={d.productos_con_reclamos} unidad="reclamos" />
            </Bloque>
          </GrillaBloques>
        </>
      )}
    </MarcoPanel>
  );
}
