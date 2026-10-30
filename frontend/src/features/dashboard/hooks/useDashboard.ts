import { useCallback } from "react";
import { useAuth } from "../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../common/api/permissions";
import { useLista } from "../../../common/hooks/useLista";
import { hoyISO } from "../../../common/utils/fechas";
import { obtenerTareasDelDia } from "../../checklist/services/checklistService";
import type { TareasDelDiaResponse } from "../../checklist/types/checklist";
import { listarIncidentes } from "../../incidente/services/incidenteService";
import type { Incidente } from "../../incidente/types/incidente";
import { listarEquipos } from "../../equipo/services/equipoService";
import type { Equipo } from "../../equipo/types/equipo";
import { listarPlanesCalibracionMantenimiento } from "../../planCalibracionMantenimiento/services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../../planCalibracionMantenimiento/types/planCalibracionMantenimiento";

/** Un bloque del panel con su estado de carga propio. */
export interface BloquePanel<T> {
  datos: T;
  loading: boolean;
  error: string | null;
}

export interface PanelInicio {
  /** El usuario puede operar: hay tareas del día y se puede pedir su porcentaje. */
  verOperacion: boolean;
  /** El usuario administra: los incidentes son un endpoint de administración. */
  verIncidentes: boolean;
  cumplimiento: BloquePanel<TareasDelDiaResponse>;
  incidentes: BloquePanel<Incidente[]>;
  /** Equipos y sus planes de calibración, para el indicador de aptos. */
  calibracion: BloquePanel<{
    equipos: Equipo[];
    planes: PlanCalibracionMantenimiento[];
  }>;
  recargar: () => Promise<void>;
}

/**
 * Datos del panel de inicio.
 *
 * El panel conserva únicamente indicadores y estadísticas propias del inicio.
 * La gestión de notificaciones y situaciones de criticidad vive en su pantalla
 * específica y ya no se carga desde acá.
 */
export function useDashboard(): PanelInicio {
  const { user } = useAuth();
  const hoy = hoyISO();

  const verOperacion = puedeOperar(user);
  const verIncidentes = puedeAdministrar(user);

  const cargarCumplimiento = useCallback(
    () =>
      verOperacion
        ? obtenerTareasDelDia(hoy)
        : Promise.resolve<TareasDelDiaResponse>({ fecha: hoy, tareas: [] }),
    [verOperacion, hoy],
  );

  const cargarIncidentes = useCallback(
    () =>
      verIncidentes
        ? listarIncidentes()
        : Promise.resolve<Incidente[]>([]),
    [verIncidentes],
  );

  const cargarCalibracion = useCallback(async () => {
    if (!verIncidentes) {
      return {
        equipos: [] as Equipo[],
        planes: [] as PlanCalibracionMantenimiento[],
      };
    }

    const [equipos, planes] = await Promise.all([
      listarEquipos(),
      listarPlanesCalibracionMantenimiento(),
    ]);

    return { equipos, planes };
  }, [verIncidentes]);

  const {
    items: tareasDelDia,
    loading: cargandoCumplimiento,
    error: errorCumplimiento,
    recargar: recargarCumplimiento,
  } = useLista<TareasDelDiaResponse>({
    cargar: cargarCumplimiento,
    dependencias: [],
    valorInicial: { fecha: hoy, tareas: [] },
    mensajeError: "No se pudo calcular el cumplimiento de hoy",
  });

  const {
    items: listaIncidentes,
    loading: cargandoIncidentes,
    error: errorIncidentes,
    recargar: recargarIncidentes,
  } = useLista<Incidente[]>({
    cargar: cargarIncidentes,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los incidentes",
  });

  const {
    items: datosCalibracion,
    loading: cargandoCalibracion,
    error: errorCalibracion,
    recargar: recargarCalibracion,
  } = useLista({
    cargar: cargarCalibracion,
    dependencias: [],
    valorInicial: {
      equipos: [] as Equipo[],
      planes: [] as PlanCalibracionMantenimiento[],
    },
    mensajeError: "No se pudo cargar el estado de calibración de los equipos",
  });

  const recargar = useCallback(
    () =>
      Promise.all([
        recargarCumplimiento(),
        recargarIncidentes(),
        recargarCalibracion(),
      ]).then(() => undefined),
    [recargarCumplimiento, recargarIncidentes, recargarCalibracion],
  );

  return {
    verOperacion,
    verIncidentes,
    cumplimiento: {
      datos: tareasDelDia,
      loading: cargandoCumplimiento,
      error: errorCumplimiento,
    },
    incidentes: {
      datos: listaIncidentes,
      loading: cargandoIncidentes,
      error: errorIncidentes,
    },
    calibracion: {
      datos: datosCalibracion,
      loading: cargandoCalibracion,
      error: errorCalibracion,
    },
    recargar,
  };
}
