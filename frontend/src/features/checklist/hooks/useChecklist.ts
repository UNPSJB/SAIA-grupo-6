import { useState, useEffect, useCallback, useRef } from "react";
import { obtenerTareasDelDia, marcarTarea } from "../services/checklistService";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import type { ConsumoTarea, TareaDelDia } from "../types/checklist";
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
  /*
   * Cambios locales hechos desde que arrancó cada recarga silenciosa. Si
   * mientras viajaba la consulta se marcó otra tarea, su respuesta ya está
   * vieja y se descarta: si no, pisaría la casilla recién tildada.
   */
  const versionRef = useRef(0);

  /**
   * Trae las tareas del día. `silencioso`: sin indicador de carga y sin
   * vaciar la lista si falla. Es la que se usa después de marcar una tarea,
   * para tomar lo que el servidor haya recalculado (estado del checklist) sin
   * que la pantalla cambie los acordeones por esqueletos, salte arriba y
   * pierda lo que se estaba cargando en otras tareas.
   */
  const cargarTareas = useCallback(async ({ silencioso = false }: { silencioso?: boolean } = {}) => {
    const version = versionRef.current;
    try {
      if (!silencioso) {
        setLoading(true);
        setError(null);
      }

      const datos = await obtenerTareasDelDia(fecha);
      if (silencioso && version !== versionRef.current) return;
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
      // En una recarga silenciosa se conserva lo que ya está en pantalla.
      if (silencioso) return;
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar las tareas del día"
      );
      setTareas([]);
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [fecha]);

  /** Recarga completa (botón "Actualizar", cambio de fecha, cobertura). */
  const recargar = useCallback(() => cargarTareas(), [cargarTareas]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void cargarTareas(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarTareas]);

  const toggleTarea = async (
    tareaId: number,
    completadoActual: boolean,
    evidencia?: File,
    consumos?: ConsumoTarea[],
    elementosLimpiezaIds?: number[]
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

    versionRef.current += 1;
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
      const registro = await marcarTarea(
        tareaId,
        nuevoEstado,
        evidencia,
        fecha,
        consumos,
        elementosLimpiezaIds
      );

      // Solo esta tarea, con lo que devolvió el servidor: quién la marcó, a
      // qué hora, la foto y el consumo. El resto de la pantalla no se toca.
      setTareas((prev) =>
        prev.map((t) =>
          t.id === tareaId
            ? {
                ...t,
                completado: registro.completado,
                fecha_completado: registro.fecha_completado ?? null,
                usuario_id: registro.usuario_id ?? null,
                evidencia_url: registro.evidencia_url ?? t.evidencia_url ?? null,
                consumos: registro.consumos ?? [],
                elementos_limpieza_ids: registro.elementos_limpieza_ids ?? [],
              }
            : t
        )
      );
      setActualizandoId(null);

      // Y en segundo plano, el resto de lo que el servidor haya recalculado.
      void cargarTareas({ silencioso: true });
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
    recargar,
  };
}
