import { useMemo, useState } from "react";
import { Box } from "@chakra-ui/react";
import type { Pagina } from "../../../../common/api/paginacion";
import { hoyISO } from "../../../../common/utils/fechas";
import { cantidadConUnidad } from "../../../../common/utils/numeros";
import { useCumplimientoLimpieza } from "../../../checklist/hooks/useCumplimientoLimpieza";
import { obtenerTareasDelDia } from "../../../checklist/services/checklistService";
import type { TareasDelDiaResponse } from "../../../checklist/types/checklist";
import { errorDeRango, rangoInicial } from "../../../checklist/types/cumplimiento";
import { listarElementosLimpieza } from "../../../elementoLimpieza/services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../../../elementoLimpieza/types/elementoLimpieza";
import { listarStockActual } from "../../../insumoQuimico/services/stockService";
import type { StockInsumoQuimico } from "../../../insumoQuimico/types/stock";
import { listarPlanesLimpieza } from "../../../planLimpieza/services/planLimpiezaService";
import type { PlanLimpieza } from "../../../planLimpieza/types/planLimpieza";
import { useBloque } from "../../hooks/useBloque";
import { calcularCumplimiento } from "../../types/dashboard";
import {
  FILAS_LISTA,
  PAGINA_COMPLETA,
  diasHasta,
  estadoPlazo,
} from "../../types/panelCategoria";
import { TarjetaCumplimiento } from "../TarjetaCumplimiento";
import {
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const paginaVacia = <T,>(): Pagina<T> => ({
  items: [],
  total: 0,
  page: 1,
  page_size: PAGINA_COMPLETA,
  total_paginas: 0,
});

const cargarTareas = () => obtenerTareasDelDia(hoyISO());
const cargarPlanes = () => listarPlanesLimpieza(1, 1);
const cargarStockBajo = () => listarStockActual(1, PAGINA_COMPLETA, { stockBajo: true });
const cargarElementos = () => listarElementosLimpieza(1, PAGINA_COMPLETA);

/** Días hasta el próximo recambio de un elemento, o `null` si no se controla. */
function diasParaRecambio(elemento: ElementoLimpieza): number | null {
  if (!elemento.fecha_ultimo_recambio || !elemento.frecuencia_recambio_dias) return null;
  return diasHasta(elemento.fecha_ultimo_recambio) + elemento.frecuencia_recambio_dias;
}

/**
 * Panel de Limpieza: cómo viene el checklist de hoy y, para quien administra,
 * qué puede frenar la limpieza de mañana (químicos con stock bajo, elementos
 * con el recambio vencido).
 */
export function PanelLimpieza({ administra }: { administra: boolean }) {
  const hoy = hoyISO();

  const tareas = useBloque<TareasDelDiaResponse>(
    cargarTareas,
    { fecha: hoy, tareas: [] },
    "No se pudo calcular el cumplimiento de hoy",
  );
  const planes = useBloque<Pagina<PlanLimpieza>>(
    cargarPlanes,
    paginaVacia<PlanLimpieza>(),
    "No se pudieron cargar los planes de limpieza",
    administra,
  );
  const stockBajo = useBloque<Pagina<StockInsumoQuimico>>(
    cargarStockBajo,
    paginaVacia<StockInsumoQuimico>(),
    "No se pudo cargar el stock de químicos",
    administra,
  );
  const elementos = useBloque<Pagina<ElementoLimpieza>>(
    cargarElementos,
    paginaVacia<ElementoLimpieza>(),
    "No se pudieron cargar los elementos de limpieza",
    administra,
  );

  // Evolución del cumplimiento por período: igual que en el inicio, es un dato
  // de administración (sale del historial de checklists).
  const [rango, setRango] = useState(() => rangoInicial(hoy));
  const errorRango = errorDeRango(rango.desde, rango.hasta, hoy);
  const periodo = useCumplimientoLimpieza(rango.desde, rango.hasta, administra && errorRango === null);

  const cumplimiento = useMemo(() => calcularCumplimiento(tareas.datos.tareas), [tareas.datos]);
  const pendientes = tareas.datos.tareas.filter((t) => !t.completado);

  const recambios = useMemo(
    () =>
      elementos.datos.items
        .filter((e) => e.activo)
        .map((e) => ({ elemento: e, dias: diasParaRecambio(e) }))
        .filter((x): x is { elemento: ElementoLimpieza; dias: number } => x.dias !== null)
        .sort((a, b) => a.dias - b.dias),
    [elementos.datos],
  );
  const recambiosVencidos = recambios.filter((r) => r.dias <= 0).length;

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Tareas pendientes hoy"
          valor={pendientes.length}
          detalle={
            cumplimiento.total === 0
              ? "No hay tareas programadas para hoy"
              : `${cumplimiento.completadas} de ${cumplimiento.total} completadas`
          }
          tono={cumplimiento.total > 0 && pendientes.length === 0 ? "ok" : undefined}
          to="/checklist"
          loading={tareas.loading}
          error={tareas.error}
        />
        {administra && (
          <>
            <Indicador
              titulo="Planes de limpieza activos"
              valor={planes.datos.total}
              to="/planes-limpieza"
              loading={planes.loading}
              error={planes.error}
            />
            <Indicador
              titulo="Químicos con stock bajo"
              valor={stockBajo.datos.total}
              detalle={stockBajo.datos.total > 0 ? "Por debajo del mínimo" : "Todos sobre el mínimo"}
              tono={stockBajo.datos.total > 0 ? "alerta" : undefined}
              to="/gestion-stock"
              loading={stockBajo.loading}
              error={stockBajo.error}
            />
            <Indicador
              titulo="Recambios vencidos"
              valor={recambiosVencidos}
              detalle={`De ${recambios.length} elementos con recambio programado`}
              tono={recambiosVencidos > 0 ? "peligro" : undefined}
              to="/elementos-limpieza"
              loading={elementos.loading}
              error={elementos.error}
            />
          </>
        )}
      </GrillaIndicadores>

      <GrillaBloques>
        <Box minW="0">
          <TarjetaCumplimiento
            total={cumplimiento.total}
            completadas={cumplimiento.completadas}
            porcentaje={cumplimiento.porcentaje}
            loading={tareas.loading}
            error={tareas.error}
            periodo={
              administra
                ? {
                    datos: periodo.serie,
                    loading: periodo.loading,
                    error: errorRango ?? periodo.error,
                    desde: rango.desde,
                    hasta: rango.hasta,
                    cambiarRango: (desde, hasta) => setRango({ desde, hasta }),
                  }
                : undefined
            }
          />
        </Box>

        <Bloque
          titulo="Tareas pendientes de hoy"
          descripcion="Lo que falta completar del checklist diario"
          loading={tareas.loading}
          error={tareas.error}
          vacio={
            pendientes.length === 0 &&
            (cumplimiento.total === 0
              ? "No hay tareas programadas para hoy."
              : "Todas las tareas de hoy están completas.")
          }
        >
          <ListaPanel
            filas={pendientes.slice(0, FILAS_LISTA).map((t) => ({
              clave: t.registro_id,
              titulo: t.nombre,
              detalle: [t.equipo_nombre, t.operador_nombre].filter(Boolean).join(" · "),
              estado: { tono: "alerta" as const, texto: "Pendiente" },
            }))}
          />
          <VerTodos to="/checklist">Ir al checklist diario</VerTodos>
        </Bloque>

        {administra && (
          <>
            <Bloque
              titulo="Químicos con stock bajo"
              descripcion="Insumos químicos por debajo de su stock mínimo"
              loading={stockBajo.loading}
              error={stockBajo.error}
              vacio={stockBajo.datos.items.length === 0 && "Ningún químico está por debajo del mínimo."}
            >
              <ListaPanel
                filas={stockBajo.datos.items.slice(0, FILAS_LISTA).map((s) => ({
                  clave: s.insumo_quimico_id,
                  titulo: s.nombre,
                  detalle:
                    s.stock_minimo === null
                      ? undefined
                      : `Mínimo: ${cantidadConUnidad(s.stock_minimo, s.unidad_simbolo ?? "")}`,
                  estado: {
                    tono: Number(s.cantidad_actual) <= 0 ? ("peligro" as const) : ("alerta" as const),
                    texto: `Quedan ${cantidadConUnidad(s.cantidad_actual, s.unidad_simbolo ?? "")}`,
                  },
                }))}
              />
              <VerTodos to="/gestion-stock">Ver el stock de químicos</VerTodos>
            </Bloque>

            <Bloque
              titulo="Recambio de elementos"
              descripcion="Elementos de limpieza según cuándo les toca el recambio"
              loading={elementos.loading}
              error={elementos.error}
              vacio={recambios.length === 0 && "No hay elementos con recambio programado."}
            >
              <ListaPanel
                filas={recambios.slice(0, FILAS_LISTA).map(({ elemento, dias }) => ({
                  clave: elemento.id,
                  titulo: elemento.nombre,
                  detalle: `Cada ${elemento.frecuencia_recambio_dias} días`,
                  estado: estadoPlazo(dias),
                }))}
              />
              <VerTodos to="/elementos-limpieza">Ver los elementos de limpieza</VerTodos>
            </Bloque>
          </>
        )}
      </GrillaBloques>
    </>
  );
}
