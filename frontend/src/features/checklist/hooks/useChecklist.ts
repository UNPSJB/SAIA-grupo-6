import { useState, useEffect, useCallback } from "react";
import { obtenerTareasDelDia, marcarTarea } from "../services/checklistService";
import type { TareaDelDia } from "../types/checklist";

// Un solo fetch para todos los equipos: el backend ya arma la lista plana
// de tareas del día con el nombre del plan al que pertenece cada una.
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
      setTareas(datos.tareas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las tareas del día");
      setTareas([]);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargarTareas();
  }, [cargarTareas]);

  const toggleTarea = async (tareaId: number, completadoActual: boolean, evidencia?: File) => {
    const tarea = tareas.find((t) => t.id === tareaId);

    if (tarea?.checklist_estado === "cerrado") {
      setError("Este checklist corresponde a un día anterior y ya no se puede modificar.");
      return;
    }

    if (tarea?.registro_id === 0) {
      setError("Todavía no llegó ese día: por ahora es solo una vista previa de las tareas.");
      return;
    }

    const nuevoEstado = !completadoActual;

    const aplicarEstado = (estado: boolean) =>
      setTareas((prev) =>
        prev.map((t) => (t.id === tareaId ? { ...t, completado: estado } : t))
      );

    try {
      setActualizandoId(tareaId);
      aplicarEstado(nuevoEstado);

      // ID del usuario simulado por ahora (Historia #20)
      const USUARIO_MOCK_ID = 1;

      // 1. Mandamos el cambio y la foto al backend
      await marcarTarea(tareaId, nuevoEstado, USUARIO_MOCK_ID, evidencia, fecha);

      // 2. Refrescamos los datos desde el servidor para traer la evidencia_url guardada
      await cargarTareas();
    } catch (err) {
      aplicarEstado(completadoActual);
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
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