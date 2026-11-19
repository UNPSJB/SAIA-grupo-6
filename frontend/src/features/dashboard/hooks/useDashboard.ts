import { useCallback } from "react";
import { useAuth } from "../../../common/context/useAuth";
import { puedeAdministrar, puedeOperar } from "../../../common/api/permissions";
import { useLista } from "../../../common/hooks/useLista";
import { hoyISO } from "../../../common/utils/fechas";
import { obtenerTareasDelDia } from "../../checklist/services/checklistService";
import type { TareasDelDiaResponse } from "../../checklist/types/checklist";

/** Un bloque del panel con su estado de carga propio. */
export interface BloquePanel<T> {
  datos: T;
  loading: boolean;
  error: string | null;
}
export interface PanelInicio {
  /** El usuario puede operar: hay tareas del día y se puede pedir su porcentaje. */
  verOperacion: boolean;
  /** El usuario administra: ve todas las áreas en el inicio. */
  verIncidentes: boolean;
  cumplimiento: BloquePanel<TareasDelDiaResponse>;
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

  const recargar = useCallback(
    () => recargarCumplimiento().then(() => undefined),
    [recargarCumplimiento],
  );
  return {
    verOperacion,
    verIncidentes,
    cumplimiento: {
      datos: tareasDelDia,
      loading: cargandoCumplimiento,
      error: errorCumplimiento,
    },
    recargar,
  };
}