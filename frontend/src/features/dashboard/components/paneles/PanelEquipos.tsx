import { useMemo } from "react";
import { Box } from "@chakra-ui/react";
import { listarEquipos } from "../../../equipo/services/equipoService";
import type { Equipo } from "../../../equipo/types/equipo";
import { listarPlanesCalibracionMantenimiento } from "../../../planCalibracionMantenimiento/services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../../../planCalibracionMantenimiento/types/planCalibracionMantenimiento";
import { useBloque } from "../../hooks/useBloque";
import { calcularEquiposCalibrados } from "../../types/dashboard";
import { DIAS_PERIODO, FILAS_LISTA, contarPor, estadoPlazo } from "../../types/panelCategoria";
import { TarjetaEquiposCalibrados } from "../TarjetaEquiposCalibrados";
import {
  BarrasHorizontales,
  Bloque,
  GrillaBloques,
  GrillaIndicadores,
  Indicador,
  ListaPanel,
  VerTodos,
} from "../piezasPanel";

const cargarEquipos = () => listarEquipos();
const cargarPlanes = () => listarPlanesCalibracionMantenimiento();

const TIPO_PLAN = { calibracion: "Calibración", mantenimiento: "Mantenimiento" } as const;

/**
 * Panel de Equipos: cuántos están en condiciones de usarse (con sus planes de
 * calibración y mantenimiento vigentes), qué intervención toca primero y cómo
 * se reparten los equipos en la planta.
 */
export function PanelEquipos() {
  const equipos = useBloque<Equipo[]>(cargarEquipos, [], "No se pudieron cargar los equipos");
  const planes = useBloque<PlanCalibracionMantenimiento[]>(
    cargarPlanes,
    [],
    "No se pudieron cargar los planes de calibración y mantenimiento",
  );

  const activos = useMemo(() => equipos.datos.filter((e) => e.activo), [equipos.datos]);
  const planesActivos = useMemo(() => planes.datos.filter((p) => p.activo), [planes.datos]);

  const calibracion = useMemo(
    () => calcularEquiposCalibrados(equipos.datos, planesActivos),
    [equipos.datos, planesActivos],
  );

  const vencidos = planesActivos.filter((p) => p.dias_restantes <= 0).length;
  const porVencer = planesActivos.filter(
    (p) => p.dias_restantes > 0 && p.dias_restantes <= DIAS_PERIODO,
  ).length;

  const conPlan = new Set(planesActivos.map((p) => p.equipo_id));
  const sinPlan = activos.filter((e) => !conPlan.has(e.id)).length;

  const nombreEquipo = useMemo(
    () => new Map(equipos.datos.map((e) => [e.id, e.nombre])),
    [equipos.datos],
  );
  const proximas = useMemo(
    () => [...planesActivos].sort((a, b) => a.dias_restantes - b.dias_restantes),
    [planesActivos],
  );

  const cargando = equipos.loading || planes.loading;
  const errorAmbos = equipos.error ?? planes.error;

  return (
    <>
      <GrillaIndicadores>
        <Indicador
          titulo="Equipos activos"
          valor={activos.length}
          to="/equipos"
          loading={equipos.loading}
          error={equipos.error}
        />
        <Indicador
          titulo="Intervenciones vencidas"
          valor={vencidos}
          detalle={vencidos > 0 ? "Calibraciones o mantenimientos fuera de fecha" : "Ninguna fuera de fecha"}
          tono={vencidos > 0 ? "peligro" : undefined}
          to="/planes-calibracion-mantenimiento"
          loading={planes.loading}
          error={planes.error}
        />
        <Indicador
          titulo="Intervenciones por vencer"
          valor={porVencer}
          detalle={`En los próximos ${DIAS_PERIODO} días`}
          tono={porVencer > 0 ? "alerta" : undefined}
          loading={planes.loading}
          error={planes.error}
        />
        <Indicador
          titulo="Equipos sin plan"
          valor={sinPlan}
          detalle={sinPlan > 0 ? "Sin calibración ni mantenimiento programado" : "Todos tienen un plan"}
          tono={sinPlan > 0 ? "alerta" : undefined}
          loading={cargando}
          error={errorAmbos}
        />
      </GrillaIndicadores>

      <GrillaBloques>
        <Box minW="0">
          <TarjetaEquiposCalibrados
            estado={calibracion}
            loading={cargando}
            error={errorAmbos}
            h="auto"
          />
        </Box>

        <Bloque
          titulo="Próximas intervenciones"
          descripcion="Calibraciones y mantenimientos, de lo más urgente a lo más lejano"
          loading={cargando}
          error={errorAmbos}
          vacio={proximas.length === 0 && "No hay planes de calibración ni mantenimiento."}
        >
          <ListaPanel
            filas={proximas.slice(0, FILAS_LISTA).map((p) => ({
              clave: p.id,
              titulo: nombreEquipo.get(p.equipo_id) ?? `Equipo #${p.equipo_id}`,
              detalle: `${TIPO_PLAN[p.tipo]} · cada ${p.periodicidad_dias} días`,
              estado: estadoPlazo(p.dias_restantes),
              to: `/equipos/detalle/${p.equipo_id}`,
            }))}
          />
          <VerTodos to="/planes-calibracion-mantenimiento">Ver todos los planes</VerTodos>
        </Bloque>

        <Bloque
          titulo="Equipos por sector"
          descripcion="Cantidad de equipos activos en cada sector"
          loading={equipos.loading}
          error={equipos.error}
          vacio={activos.length === 0 && "No hay equipos cargados."}
        >
          <BarrasHorizontales datos={contarPor(activos, (e) => e.sector.nombre)} unidad="equipos" />
        </Bloque>

        <Bloque
          titulo="Equipos por tipo"
          descripcion="Cantidad de equipos activos de cada tipo"
          loading={equipos.loading}
          error={equipos.error}
          vacio={activos.length === 0 && "No hay equipos cargados."}
        >
          <BarrasHorizontales
            datos={contarPor(activos, (e) => e.tipo).slice(0, 8)}
            unidad="equipos"
          />
        </Bloque>
      </GrillaBloques>
    </>
  );
}
