import { useCallback } from "react";
import { useAuth } from "../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../common/api/permissions";
import { useLista } from "../../../common/hooks/useLista";
import { hoyISO } from "../../../common/utils/fechas";
import { obtenerTareasDelDia } from "../../checklist/services/checklistService";
import type { TareasDelDiaResponse } from "../../checklist/types/checklist";
import { listarIncidentes } from "../../incidente/services/incidenteService";
import type { Incidente } from "../../incidente/types/incidente";
import { obtenerNotificaciones } from "../../notificaciones/services/notificacionService";
import type { Notificacion } from "../../notificaciones/types/notificacion";
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
  /** El usuario administra: incidentes y alertas son endpoints suyos. */
  verIncidentes: boolean;
  cumplimiento: BloquePanel<TareasDelDiaResponse>;
  incidentes: BloquePanel<Incidente[]>;
  alertas: BloquePanel<Notificacion[]>;
  /** Equipos y sus planes de calibración, para el indicador de aptos. */
  calibracion: BloquePanel<{ equipos: Equipo[]; planes: PlanCalibracionMantenimiento[] }>;
  recargar: () => Promise<void>;
  /** Solo las alertas: lo que hace falta después de registrar un recambio. */
  recargarAlertas: () => Promise<void>;
}

/**
 * Datos del panel de inicio.
 *
 * Son tres cargas **independientes** y no un `Promise.all`: si el listado de
 * incidentes falla, el cumplimiento de POES tiene que seguir en pantalla en
 * vez de caer con él. Además, cada endpoint pide un permiso distinto
 * (`/checklist/tareas-del-dia` es de operación, `/incidentes` y
 * `/notificaciones` son de administración), así que un operador no puede
 * pedirlos: acá se resuelve a lista vacía y la pantalla decide qué tarjetas
 * mostrar, en vez de pedir y recibir un 403.
 */
export function useDashboard(): PanelInicio {
  const { user } = useAuth();

  // Se resuelve una vez por render: la cadena solo cambia al cambiar el día, que
  // es justo cuando tiene que volver a pedir las tareas.
  const hoy = hoyISO();

  const verOperacion = puedeOperar(user);
  const verIncidentes = puedeAdministrar(user);

  const cargarCumplimiento = useCallback(
    () =>
      verOperacion
        ? obtenerTareasDelDia(hoy)
        : Promise.resolve<TareasDelDiaResponse>({ fecha: hoy, tareas: [] }),
    [verOperacion, hoy]
  );

  // Sin `estado`: la torta filtra por los dos lados (abiertos / cerrados / todos)
  // y pedir la lista una sola vez hace que cambiar el filtro sea inmediato.
  const cargarIncidentes = useCallback(
    () => (verIncidentes ? listarIncidentes() : Promise.resolve<Incidente[]>([])),
    [verIncidentes]
  );

  const cargarAlertas = useCallback(
    () =>
      verIncidentes
        ? obtenerNotificaciones()
        : Promise.resolve<Notificacion[]>([]),
    [verIncidentes]
  );

  /*
   * Equipos y planes van juntos en un solo bloque: la tarjeta de calibración
   * necesita los dos, y si se pidieran por separado una de las dos mitades
   * calcularía "0 equipos aptos" o "todo pendiente" según cuál llegara.
   */
  const cargarCalibracion = useCallback(async () => {
    if (!verIncidentes) return { equipos: [] as Equipo[], planes: [] as PlanCalibracionMantenimiento[] };

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
    items: listaAlertas,
    loading: cargandoAlertas,
    error: errorAlertas,
    recargar: recargarAlertas,
  } = useLista<Notificacion[]>({
    cargar: cargarAlertas,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las alertas",
  });

  const {
    items: datosCalibracion,
    loading: cargandoCalibracion,
    error: errorCalibracion,
    recargar: recargarCalibracion,
  } = useLista({
    cargar: cargarCalibracion,
    dependencias: [],
    valorInicial: { equipos: [] as Equipo[], planes: [] as PlanCalibracionMantenimiento[] },
    mensajeError: "No se pudo cargar el estado de calibración de los equipos",
  });

  // Cada bloque se recarga por separado: si el `Promise.all` tirara, el botón
  // "Actualizar" no recargaría nada.
  const recargar = useCallback(
    () =>
      Promise.all([
        recargarCumplimiento(),
        recargarIncidentes(),
        recargarAlertas(),
        recargarCalibracion(),
      ]).then(() => undefined),
    [
      recargarCumplimiento,
      recargarIncidentes,
      recargarAlertas,
      recargarCalibracion,
    ]
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
    alertas: {
      datos: listaAlertas,
      loading: cargandoAlertas,
      error: errorAlertas,
    },
    calibracion: {
      datos: datosCalibracion,
      loading: cargandoCalibracion,
      error: errorCalibracion,
    },
    recargar,
    recargarAlertas,
  };
}
