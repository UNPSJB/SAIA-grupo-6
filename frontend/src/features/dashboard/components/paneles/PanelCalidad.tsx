import { useMemo, useState } from "react";
import type { Pagina } from "../../../../common/api/paginacion";
import { formatoFecha, haceDiasISO, hoyISO } from "../../../../common/utils/fechas";
import { formatoCantidad } from "../../../../common/utils/numeros";
import { listarDocumentos } from "../../../documentos/services/documentoService";
import type { Documento } from "../../../documentos/types/documento";
import {
  listarIncidentes,
  listarMisIncidentes,
} from "../../../incidente/services/incidenteService";
import type { Incidente } from "../../../incidente/types/incidente";
import { obtenerVencimientos } from "../../../vencimientos/services/vencimientoService";
import {
  TIPOS_VENCIMIENTO,
  type VencimientoConsolidado,
} from "../../../vencimientos/types/vencimiento";
import { useBloque } from "../../hooks/useBloque";
import {
  incidentesPorPeriodo,
  partesPorTipo,
  type RangoFechas,
} from "../../types/dashboard";
import { DIAS_PERIODO, FILAS_LISTA, diasHasta } from "../../types/panelCategoria";
import { GraficoTorta } from "../GraficoTorta";
import { TarjetaIniciadosResueltos } from "../TarjetaIniciadosResueltos";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const cargarIncidentes = () => listarIncidentes();
const cargarMisIncidentes = () => listarMisIncidentes();
const cargarVencimientos = () => obtenerVencimientos();
const cargarDocumentos = () => listarDocumentos(1, 1);

const SIN_DOCUMENTOS: Pagina<Documento> = {
  items: [],
  total: 0,
  page: 1,
  page_size: 1,
  total_paginas: 0,
};

const MS_POR_DIA = 86_400_000;

/** Días que lleva abierto un incidente (o que tardó en cerrarse). */
function diasEntre(desde: string, hasta: string | null): number {
  const fin = hasta ? new Date(hasta).getTime() : Date.now();
  return Math.max(0, Math.round((fin - new Date(desde).getTime()) / MS_POR_DIA));
}

const antiguedad = (dias: number) =>
  dias === 0 ? "Abierto hoy" : `Abierto hace ${dias} ${dias === 1 ? "día" : "días"}`;

/**
 * Panel de Calidad.
 *
 * Quien administra ve el estado general: incidentes sin cerrar, cuánto se
 * tarda en cerrarlos y qué vencimientos (personal, calibraciones, documentos)
 * están encima. Quien opera solo puede ver sus propios reportes, así que su
 * panel es el seguimiento de lo que reportó.
 */
export function PanelCalidad({ administra }: { administra: boolean }) {
  return administra ? <PanelCalidadAdministracion /> : <PanelCalidadOperacion />;
}

function PanelCalidadAdministracion() {
  const incidentes = useBloque<Incidente[]>(
    cargarIncidentes,
    [],
    "No se pudieron cargar los incidentes",
  );
  const vencimientos = useBloque<VencimientoConsolidado[]>(
    cargarVencimientos,
    [],
    "No se pudieron cargar los vencimientos",
  );
  const documentos = useBloque<Pagina<Documento>>(
    cargarDocumentos,
    SIN_DOCUMENTOS,
    "No se pudieron cargar los documentos",
  );

  // Cada gráfico de incidentes tiene su propio período, como en el inicio.
  const [rangoTorta, setRangoTorta] = useState<RangoFechas>(() => ({
    desde: haceDiasISO(DIAS_PERIODO),
    hasta: hoyISO(),
  }));
  const [rangoSerie, setRangoSerie] = useState<RangoFechas>(() => ({
    desde: haceDiasISO(DIAS_PERIODO),
    hasta: hoyISO(),
  }));

  const resumen = useMemo(() => {
    const desde = haceDiasISO(DIAS_PERIODO);
    const abiertos = incidentes.datos
      .filter((i) => i.estado === "abierto")
      .sort((a, b) => a.fecha_reporte.localeCompare(b.fecha_reporte));
    const cerrados = incidentes.datos.filter((i) => i.estado === "cerrado" && i.fecha_cierre);
    const promedio =
      cerrados.length === 0
        ? null
        : cerrados.reduce((suma, i) => suma + diasEntre(i.fecha_reporte, i.fecha_cierre), 0) /
          cerrados.length;
    return {
      abiertos,
      reportados: incidentes.datos.filter((i) => i.fecha_reporte.slice(0, 10) >= desde).length,
      cerrados: cerrados.length,
      promedio,
    };
  }, [incidentes.datos]);

  const partes = useMemo(
    () => partesPorTipo(incidentes.datos, "todos", rangoTorta),
    [incidentes.datos, rangoTorta],
  );
  const serie = useMemo(
    () =>
      rangoSerie.desde && rangoSerie.hasta && rangoSerie.desde <= rangoSerie.hasta
        ? incidentesPorPeriodo(incidentes.datos, rangoSerie)
        : [],
    [incidentes.datos, rangoSerie],
  );

  const vencidos = vencimientos.datos.filter((v) => v.estado === "VENCIDO");
  const proximos = vencimientos.datos.filter((v) => v.estado === "PROXIMO");
  // Lo que pide atención, por tipo: vencidos y próximos juntos.
  const atencionPorTipo = TIPOS_VENCIMIENTO.map(({ value, label }) => ({
    etiqueta: label,
    valor: [...vencidos, ...proximos].filter((v) => v.tipo === value).length,
  }));

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Incidentes abiertos"
          valor={resumen.abiertos.length}
          detalle={resumen.abiertos.length > 0 ? "Sin cerrar" : "Ninguno pendiente"}
          tono={resumen.abiertos.length > 0 ? "alerta" : undefined}
          to="/incidentes"
          loading={incidentes.loading}
          error={incidentes.error}
        />
        <Indicador
          titulo="Incidentes reportados"
          valor={resumen.reportados}
          detalle={`Últimos ${DIAS_PERIODO} días`}
          loading={incidentes.loading}
          error={incidentes.error}
        />
        <Indicador
          titulo="Tiempo medio de cierre"
          valor={
            resumen.promedio === null
              ? "—"
              : `${formatoCantidad(Math.round(resumen.promedio * 10) / 10)} d`
          }
          detalle={
            resumen.promedio === null
              ? "Todavía no se cerró ninguno"
              : `Días, sobre ${resumen.cerrados} ${resumen.cerrados === 1 ? "cerrado" : "cerrados"}`
          }
          loading={incidentes.loading}
          error={incidentes.error}
        />
        <Indicador
          titulo="Vencimientos vencidos"
          valor={vencidos.length}
          detalle={vencidos.length > 0 ? "Personal, equipos y documentos" : "Nada vencido"}
          tono={vencidos.length > 0 ? "peligro" : undefined}
          to="/vencimientos"
          loading={vencimientos.loading}
          error={vencimientos.error}
        />
        <Indicador
          titulo="Próximos a vencer"
          valor={proximos.length}
          tono={proximos.length > 0 ? "alerta" : undefined}
          to="/vencimientos"
          loading={vencimientos.loading}
          error={vencimientos.error}
        />
        <Indicador
          titulo="Documentos"
          valor={documentos.datos.total}
          to="/documentos"
          loading={documentos.loading}
          error={documentos.error}
        />
      </GrillaIndicadores>

      <GrillaBloques>
        <GraficoTorta
          partes={partes}
          loading={incidentes.loading}
          error={incidentes.error}
          rango={rangoTorta}
          onCambiarRango={setRangoTorta}
          h="auto"
        />

        <TarjetaIniciadosResueltos
          datos={serie}
          loading={incidentes.loading}
          error={incidentes.error}
          rango={rangoSerie}
          onCambiarRango={setRangoSerie}
          h="auto"
        />

        <Bloque
          titulo="Incidentes abiertos más antiguos"
          descripcion="Los que más tiempo llevan sin cerrarse"
          loading={incidentes.loading}
          error={incidentes.error}
          vacio={resumen.abiertos.length === 0 && "No hay incidentes abiertos."}
        >
          <ListaPanel
            filas={resumen.abiertos.slice(0, FILAS_LISTA).map((i) => {
              const dias = diasEntre(i.fecha_reporte, null);
              return {
                clave: i.id,
                titulo: i.titulo,
                detalle: `#${i.id} · reportado el ${formatoFecha(i.fecha_reporte)}${
                  i.usuario_nombre ? ` por ${i.usuario_nombre}` : ""
                }`,
                estado: { tono: dias > 7 ? ("peligro" as const) : ("alerta" as const), texto: antiguedad(dias) },
                to: `/incidentes/${i.id}`,
              };
            })}
          />
          <VerTodos to="/incidentes">Ver todos los incidentes</VerTodos>
        </Bloque>

        <Bloque
          titulo="Vencimientos que piden atención"
          descripcion="Vencidos y próximos a vencer, por tipo"
          loading={vencimientos.loading}
          error={vencimientos.error}
          vacio={vencidos.length + proximos.length === 0 && "No hay vencimientos pendientes."}
        >
          <BarrasHorizontales datos={atencionPorTipo} unidad="vencimientos" />
          <VerTodos to="/vencimientos">Ver los vencimientos</VerTodos>
        </Bloque>
      </GrillaBloques>
    </>
  );
}

function PanelCalidadOperacion() {
  const mios = useBloque<Incidente[]>(
    cargarMisIncidentes,
    [],
    "No se pudieron cargar tus incidentes",
  );

  const desde = haceDiasISO(DIAS_PERIODO);
  const abiertos = mios.datos.filter((i) => i.estado === "abierto");
  const recientes = [...mios.datos].sort((a, b) => b.fecha_reporte.localeCompare(a.fecha_reporte));

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Mis incidentes abiertos"
          valor={abiertos.length}
          detalle={abiertos.length > 0 ? "Todavía sin cerrar" : "Ninguno pendiente"}
          tono={abiertos.length > 0 ? "alerta" : undefined}
          to="/incidentes/reportar"
          loading={mios.loading}
          error={mios.error}
        />
        <Indicador
          titulo="Mis incidentes cerrados"
          valor={mios.datos.length - abiertos.length}
          loading={mios.loading}
          error={mios.error}
        />
        <Indicador
          titulo="Reportados por mí"
          valor={mios.datos.filter((i) => i.fecha_reporte.slice(0, 10) >= desde).length}
          detalle={`Últimos ${DIAS_PERIODO} días`}
          loading={mios.loading}
          error={mios.error}
        />
      </GrillaIndicadores>

      <GrillaBloques>
        <Bloque
          titulo="Mis últimos reportes"
          descripcion="Los incidentes que reportaste, del más nuevo al más viejo"
          loading={mios.loading}
          error={mios.error}
          vacio={recientes.length === 0 && "Todavía no reportaste ningún incidente."}
        >
          <ListaPanel
            filas={recientes.slice(0, FILAS_LISTA).map((i) => ({
              clave: i.id,
              titulo: i.titulo,
              detalle: `#${i.id} · reportado el ${formatoFecha(i.fecha_reporte)}`,
              estado:
                i.estado === "cerrado"
                  ? { tono: "ok" as const, texto: "Cerrado" }
                  : { tono: "alerta" as const, texto: antiguedad(diasHasta(i.fecha_reporte) * -1) },
            }))}
          />
          <VerTodos to="/incidentes/reportar">Ver mis reportes</VerTodos>
        </Bloque>
      </GrillaBloques>
    </>
  );
}
