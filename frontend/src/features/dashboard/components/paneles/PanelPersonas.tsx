import { Stack } from "@chakra-ui/react";
import { LuBadgeAlert, LuBuilding2, LuTruck, LuUsers } from "react-icons/lu";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { usePanel } from "../../hooks/usePanel";
import { plural, textoPeriodo, type PanelPersonas as DatosPersonas } from "../../types/paneles";
import { BarraEstados, Medidor } from "../graficos";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  ListaPanel,
  MarcoPanel,
  MetricasBloque,
  VerTodos,
} from "../piezasPanel";

const TONO_CERTIFICACION = { vigente: "ok", por_vencer: "alerta", vencida: "peligro" } as const;

/**
 * Panel de Personas: si las aptitudes del personal están al día, cómo cumple
 * cada operador sus tareas, y con qué clientes y transportistas se opera.
 */
export function PanelPersonas() {
  const panel = usePanel<DatosPersonas>("personas");
  const periodo = textoPeriodo(panel.dias);

  return (
    <MarcoPanel panel={panel}>
      {(d) => (
        <>
          <GrillaBloques principal>
            <Bloque
              titulo="Cumplimiento por operador"
              descripcion={`Tareas de limpieza completadas sobre las asignadas en los ${periodo}`}
              vacio={
                d.cumplimiento_por_operador.length === 0 && "No hubo tareas asignadas en el período."
              }
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "personal",
                      etiqueta: "Personal activo",
                      valor: formatoCantidad(d.personal_activo),
                      icono: LuUsers,
                      detalle: `${plural(d.personal_inactivo, "inactivo", "inactivos")}`,
                    },
                  ]}
                />
              }
            >
              <BarrasHorizontales datos={d.cumplimiento_por_operador} sufijo="%" />
            </Bloque>

            <Bloque
              titulo="Cumplimiento de tareas"
              descripcion={`Tareas de limpieza asignadas y completadas en los ${periodo}`}
            >
              <Medidor
                valor={d.cumplimiento_tareas}
                detalle={
                  d.cumplimiento_tareas === null
                    ? "Sin tareas asignadas en el período"
                    : `${d.tareas_completadas} de ${plural(d.tareas_asignadas, "tarea asignada", "tareas asignadas")}`
                }
              />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Aptitudes vencidas o por vencer"
              descripcion="De lo más urgente a lo más lejano"
              vacio={d.aptitudes_atencion.length === 0 && "Todas las aptitudes del personal están al día."}
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "vencidas",
                      etiqueta: "Aptitudes vencidas",
                      valor: formatoCantidad(d.aptitudes_vencidas),
                      icono: LuBadgeAlert,
                      detalle: `${plural(d.aptitudes_proximas, "por vencer", "por vencer")}`,
                    },
                  ]}
                />
              }
            >
              <ListaPanel filas={d.aptitudes_atencion} acento />
              <VerTodos to="/vencimientos">Ver los vencimientos</VerTodos>
            </Bloque>

            <Bloque
              titulo="Incidentes reportados por persona"
              descripcion={`Quiénes reportaron incidentes en los ${periodo}`}
              vacio={d.incidentes_por_persona.length === 0 && "Nadie reportó incidentes en el período."}
            >
              <BarrasHorizontales datos={d.incidentes_por_persona} unidad="incidentes" />
            </Bloque>
          </GrillaBloques>

          <GrillaBloques>
            <Bloque
              titulo="Clientes con más salidas"
              descripcion={`Salidas de producto registradas en los ${periodo}, y sus reclamos`}
              vacio={d.clientes_con_mas_salidas.length === 0 && "No hubo salidas en el período."}
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "clientes",
                      etiqueta: "Clientes activos",
                      valor: formatoCantidad(d.clientes_activos),
                      icono: LuBuilding2,
                      detalle: `${plural(d.clientes_inactivos, "inactivo", "inactivos")}`,
                    },
                  ]}
                />
              }
            >
              <BarrasHorizontales datos={d.clientes_con_mas_salidas} mostrar="detalle" />
              <VerTodos to="/clientes">Ver los clientes</VerTodos>
            </Bloque>

            <Bloque
              titulo="Transportistas"
              descripcion={`Salidas a cargo de cada uno en los ${periodo} y estado de sus certificaciones`}
              acciones={
                <MetricasBloque
                  enCabecera
                  metricas={[
                    {
                      clave: "transportistas",
                      etiqueta: "Transportistas activos",
                      valor: formatoCantidad(d.transportistas_activos),
                      icono: LuTruck,
                      detalle: `${plural(d.certificaciones_transporte_vencidas, "certificación vencida", "certificaciones vencidas")}`,
                    },
                  ]}
                />
              }
            >
              <Stack gap="6">
                {d.entregas_por_transportista.length > 0 ? (
                  <BarrasHorizontales datos={d.entregas_por_transportista} unidad="salidas" />
                ) : null}
                <BarraEstados
                  titulo="Certificaciones"
                  vacio="No hay certificaciones cargadas."
                  segmentos={d.certificaciones_transporte.map((c) => ({
                    clave: c.clave,
                    etiqueta: c.etiqueta,
                    valor: c.valor,
                    tono: TONO_CERTIFICACION[c.clave as keyof typeof TONO_CERTIFICACION],
                  }))}
                />
              </Stack>
              <VerTodos to="/transportistas">Ver los transportistas</VerTodos>
            </Bloque>
          </GrillaBloques>
        </>
      )}
    </MarcoPanel>
  );
}
