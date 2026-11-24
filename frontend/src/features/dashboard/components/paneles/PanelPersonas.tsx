import { useState } from "react";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { LuBadgeAlert, LuBuilding2, LuTriangleAlert, LuTruck, LuUsers } from "react-icons/lu";
import { formatoCantidad, formatoPorcentaje } from "../../../../common/utils/numeros";
import { useColorModeValue } from "../../../../components/ui/color-mode";
import { usePanel } from "../../hooks/usePanel";
import { plural, textoPeriodo, type PanelPersonas as DatosPersonas } from "../../types/paneles";
import {
  COLOR_CUMPLIMIENTO,
  COLOR_ESTADO,
  COLOR_SERIE,
  CATEGORICO,
  type ParteDona,
} from "../../types/coloresGraficos";
import { BarraEstados, BarrasApiladas, GraficoBarrasCategoria, GraficoDona, GraficoPaleta } from "../graficos";
import { Bloque, GrillaBloques, ListaPanel, MarcoPanel, MetricasBloque, VerTodos } from "../piezasPanel";

const TONO_CERTIFICACION = { vigente: "ok", por_vencer: "alerta", vencida: "peligro" } as const;

/** Con más transportistas que esto, la dona no se lee: van en paletas. */
const MAXIMO_DONA = CATEGORICO.claro.length;

/** Cómo se ordena y se mide el bloque de cumplimiento por operador. */
type VistaOperador = "porcentaje" | "cantidad";

const VISTAS_OPERADOR: { valor: VistaOperador; etiqueta: string }[] = [
  { valor: "porcentaje", etiqueta: "% de cumplimiento" },
  { valor: "cantidad", etiqueta: "Tareas completadas" },
];

/** Salidas de un cliente: las que tuvieron algún reclamo, aparte. */
const PARTES_SALIDAS = [
  { clave: "sin_reclamo", etiqueta: "Salidas sin reclamo", color: COLOR_SERIE.azul },
  { clave: "con_reclamo", etiqueta: "Con reclamo", color: COLOR_ESTADO.peligro },
];

/** Completadas sobre asignadas, como reparto: lo que falta va en gris. */
function partesTareas(d: DatosPersonas): ParteDona[] {
  return [
    {
      clave: "completadas",
      etiqueta: "Completadas",
      valor: d.tareas_completadas,
      detalle: null,
      color: COLOR_CUMPLIMIENTO,
    },
    {
      clave: "no_completadas",
      etiqueta: "No completadas",
      valor: d.tareas_asignadas - d.tareas_completadas,
      detalle: null,
      color: COLOR_ESTADO.neutro,
    },
  ];
}

/**
 * Panel de Personas: si las aptitudes del personal están al día, cómo cumple
 * cada operador sus tareas, y con qué clientes y transportistas se opera.
 */
export function PanelPersonas() {
  const panel = usePanel<DatosPersonas>("personas");
  const periodo = textoPeriodo(panel.dias);
  const [vistaOperador, setVistaOperador] = useState<VistaOperador>("porcentaje");
  const colores = useColorModeValue<readonly string[]>(CATEGORICO.claro, CATEGORICO.oscuro);

  return (
    <MarcoPanel panel={panel}>
      {(d) => {
        const totalAptitudes = d.aptitudes_vigentes + d.aptitudes_proximas + d.aptitudes_vencidas;
        return (
          <>
            <GrillaBloques principal>
              <Bloque
                titulo="Cumplimiento por operador"
                descripcion={
                  vistaOperador === "porcentaje"
                    ? `Tareas de limpieza completadas sobre las asignadas en los ${periodo}`
                    : `Quiénes completaron más tareas de limpieza en los ${periodo}`
                }
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
                <HStack gap="1" mb="4" role="group" aria-label="Ordenar operadores por">
                  {VISTAS_OPERADOR.map((v) => (
                    <Button
                      key={v.valor}
                      size="xs"
                      colorPalette="brand"
                      variant={v.valor === vistaOperador ? "solid" : "outline"}
                      aria-pressed={v.valor === vistaOperador}
                      onClick={() => setVistaOperador(v.valor)}
                    >
                      {v.etiqueta}
                    </Button>
                  ))}
                </HStack>
                {vistaOperador === "porcentaje" ? (
                  <GraficoPaleta
                    datos={d.cumplimiento_por_operador}
                    unidad="%"
                    maximo={100}
                    color={COLOR_CUMPLIMIENTO}
                    texto={(dato) =>
                      `${dato.detalle ? `${dato.detalle} · ` : ""}${formatoCantidad(dato.valor)}%`
                    }
                  />
                ) : (
                  // Volumen de trabajo: azul, y el largo contra quien más hizo.
                  <GraficoPaleta
                    datos={d.tareas_completadas_por_operador}
                    unidad="tareas"
                    color={COLOR_SERIE.azul}
                    texto={(dato) => dato.detalle ?? plural(dato.valor, "tarea", "tareas")}
                  />
                )}
              </Bloque>

              <Bloque
                titulo="Cumplimiento de tareas"
                descripcion={`Tareas de limpieza asignadas y completadas en los ${periodo}`}
                vacio={d.cumplimiento_tareas === null && "No hubo tareas asignadas en el período."}
              >
                <GraficoDona
                  partes={partesTareas(d)}
                  unidad="tareas"
                  centro={{
                    valor: formatoPorcentaje(d.cumplimiento_tareas),
                    texto: plural(d.tareas_asignadas, "tarea", "tareas"),
                  }}
                />
              </Bloque>
            </GrillaBloques>

            <GrillaBloques>
              <Bloque
                titulo="Aptitudes vencidas o por vencer"
                descripcion="De lo más urgente a lo más lejano"
                vacio={totalAptitudes === 0 && "No hay aptitudes del personal cargadas."}
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
                <Stack gap="5">
                  <BarraEstados
                    vacio="No hay aptitudes cargadas."
                    segmentos={[
                      { clave: "vigentes", etiqueta: "Al día", valor: d.aptitudes_vigentes, tono: "ok" },
                      {
                        clave: "por_vencer",
                        etiqueta: "Por vencer",
                        valor: d.aptitudes_proximas,
                        tono: "alerta",
                      },
                      { clave: "vencidas", etiqueta: "Vencidas", valor: d.aptitudes_vencidas, tono: "peligro" },
                    ]}
                  />
                  {d.aptitudes_atencion.length > 0 ? (
                    <ListaPanel filas={d.aptitudes_atencion} acento />
                  ) : (
                    <Text fontSize="sm" color="fg.muted">
                      Todas las aptitudes del personal están al día.
                    </Text>
                  )}
                </Stack>
                <VerTodos to="/vencimientos">Ver los vencimientos</VerTodos>
              </Bloque>

              <Bloque
                titulo="Incidentes reportados por persona"
                descripcion={`Quiénes reportaron incidentes en los ${periodo}`}
                vacio={d.incidentes_por_persona.length === 0 && "Nadie reportó incidentes en el período."}
                acciones={
                  <MetricasBloque
                    enCabecera
                    metricas={[
                      {
                        clave: "incidentes",
                        etiqueta: "Incidentes reportados",
                        valor: formatoCantidad(d.incidentes_reportados),
                        icono: LuTriangleAlert,
                        detalle: `En los ${periodo}`,
                      },
                    ]}
                  />
                }
              >
                <GraficoBarrasCategoria
                  datos={d.incidentes_por_persona}
                  unidad="incidentes"
                  unidadUno="incidente"
                  color={COLOR_SERIE.naranja}
                  resumen={`Incidentes reportados por persona en los ${periodo}`}
                  // Los incidentes que reportó esa persona, en el mismo período.
                  destino={(dato) => ({
                    to: `/incidentes?${new URLSearchParams({
                      reportado_por: dato.clave,
                      desde: d.periodo.desde,
                      hasta: d.periodo.hasta,
                    })}`,
                    state: { reportadoNombre: dato.etiqueta },
                    pista: "Clic para ver incidentes",
                  })}
                />
              </Bloque>
            </GrillaBloques>

            <GrillaBloques>
              <Bloque
                titulo="Clientes con más salidas"
                descripcion={`Salidas de producto registradas en los ${periodo}, y cuántas tuvieron reclamos`}
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
                <BarrasApiladas
                  partes={PARTES_SALIDAS}
                  filas={d.clientes_con_mas_salidas.map((c) => {
                    const conReclamo = Math.min(d.salidas_con_reclamo_por_cliente[c.clave] ?? 0, c.valor);
                    return {
                      clave: c.clave,
                      etiqueta: c.etiqueta,
                      valores: [c.valor - conReclamo, conReclamo],
                      texto: conReclamo
                        ? `${plural(c.valor, "salida", "salidas")} · ${formatoCantidad(conReclamo)} con reclamo`
                        : plural(c.valor, "salida", "salidas"),
                    };
                  })}
                />
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
                        detalleAlerta: d.certificaciones_transporte_vencidas > 0,
                      },
                    ]}
                  />
                }
              >
                <Stack gap="6" flex="1">
                  {d.entregas_por_transportista.length === 0 ? (
                    <Text fontSize="sm" color="fg.muted">
                      No hubo salidas con transportista en el período.
                    </Text>
                  ) : d.entregas_por_transportista.length <= MAXIMO_DONA ? (
                    <GraficoDona
                      unidad="salidas"
                      partes={d.entregas_por_transportista.map((t, i) => ({ ...t, color: colores[i] }))}
                    />
                  ) : (
                    <GraficoPaleta
                      datos={d.entregas_por_transportista}
                      unidad="salidas"
                      color={COLOR_SERIE.azul}
                    />
                  )}
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
        );
      }}
    </MarcoPanel>
  );
}
