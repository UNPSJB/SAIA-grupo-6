import { useState, useEffect, useCallback } from "react";
import { obtenerTareasDelDia, marcarTarea } from "../services/checklistService";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import type { TareaDelDia } from "../types/checklist";
import { hoyISO } from "../../../common/utils/fechas";

// Un solo fetch para todos los equipos: el backend ya arma la lista plana
// de tareas del día con el nombre del plan al que pertenece cada una.
// El usuario que completa cada tarea lo toma el backend del token de sesión,
// por eso este hook no lo necesita.
export function useChecklist(fecha: string) {
  const [tareas, setTareas] = useState<TareaDelDia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);

  const cargarTareas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const datos = await obtenerTareasDelDia(fecha);
      /*
       * Un día anterior a hoy es de solo lectura, diga lo que diga el estado
       * guardado. El backend ya lo informa como "cerrado", pero se refuerza
       * acá por la fecha: antes un día pasado llegaba "abierto", la casilla
       * quedaba habilitada, la barra subía y bajaba al rechazarse el cambio.
       */
      const diaPasado = fecha < hoyISO();
      setTareas(
        diaPasado
          ? datos.tareas.map((t) =>
              t.registro_id > 0 ? { ...t, checklist_estado: "cerrado" as const } : t,
            )
          : datos.tareas,
      );
      // El backend puede haber creado el checklist de hoy y recalculado
      // notificaciones: avisamos a la campana para que refresque el contador.
      notificarCambioNotificaciones();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las tareas del día"
      );
      setTareas([]);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarTareas, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarTareas]);

  const toggleTarea = async (
    tareaId: number,
    completadoActual: boolean,
    evidencia?: File,
    insumoQuimicoId?: number,
    cantidadConsumida?: number,
    elementoLimpiezaId?: number
  ) => {
    const tarea = tareas.find((t) => t.id === tareaId);

    // Se valida ANTES de tocar el estado local: el cambio optimista de abajo
    // es el que hacía subir la barra de avance aunque después se rechazara.
    if (tarea?.checklist_estado === "cerrado" || fecha < hoyISO()) {
      setError(
        "Este checklist corresponde a un día anterior y ya no se puede modificar."
      );
      return;
    }

    if (tarea?.registro_id === 0) {
      setError(
        "Todavía no llegó ese día: por ahora es solo una vista previa de las tareas."
      );
      return;
    }

    const nuevoEstado = !completadoActual;

    const aplicarEstado = (estado: boolean) =>
      setTareas((prev) =>
        prev.map((t) =>
          t.id === tareaId
            ? { ...t, completado: estado }
            : t
        )
      );

    try {
      setActualizandoId(tareaId);
      setError(null);

      aplicarEstado(nuevoEstado);

      // Mandamos:
      // - estado de la tarea
      // - evidencia
      // - fecha
      // - insumo químico utilizado
      // - cantidad aproximada consumida
      await marcarTarea(
        tareaId,
        nuevoEstado,
        evidencia,
        fecha,
        insumoQuimicoId,
        cantidadConsumida,
        elementoLimpiezaId
      );

      // Refrescamos los datos desde el servidor
      await cargarTareas();
    } catch (err) {
      aplicarEstado(completadoActual);

      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la tarea"
      );
    } finally {
      setActualizandoId(null);
    }
  };

  return {
    tareas,
    loading,
    error,
    actualizandoId,
    toggleTarea,
    recargar: cargarTareas,
  };
}
