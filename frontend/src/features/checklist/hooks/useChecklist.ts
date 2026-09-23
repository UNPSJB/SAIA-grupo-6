import { useState, useEffect, useCallback } from "react";
import { obtenerChecklistHoy, marcarTarea } from "../services/checklistService";
import type { ChecklistPlanItem, ChecklistResponse } from "../types/checklist";

export function useChecklist(equipoId: number | null, fecha?: string) {
  const [checklistData, setChecklistData] = useState<ChecklistResponse | null>(null);
  const [planes, setPlanes] = useState<ChecklistPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);

  const cargarChecklist = useCallback(async () => {
    if (!equipoId) {
      setPlanes([]);
      setChecklistData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await obtenerChecklistHoy(equipoId, fecha);
      setChecklistData(data);
      setPlanes(data.planes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el checklist");
      setPlanes([]);
      setChecklistData(null);
    } finally {
      setLoading(false);
    }
  }, [equipoId, fecha]);

  useEffect(() => {
    cargarChecklist();
  }, [cargarChecklist]);

  const toggleTarea = async (tareaId: number, completadoActual: boolean, evidencia?: File) => {
    try {
      setActualizandoId(tareaId);
      const nuevoEstado = !completadoActual;

      // Actualización optimista en la interfaz
      setPlanes((prevPlanes) =>
        prevPlanes.map((plan) => ({
          ...plan,
          tareas: plan.tareas.map((t) =>
            t.id === tareaId ? { ...t, completado: nuevoEstado } : t
          ),
        }))
      );

      // ID del usuario simulado por ahora (Historia #20)
      const USUARIO_MOCK_ID = 1; 

      // 1. Mandamos el cambio y la foto al backend
      await marcarTarea(tareaId, nuevoEstado, USUARIO_MOCK_ID, evidencia, fecha);

      // 2. Refrescamos los datos desde el servidor para traer la evidencia_url guardada
      await cargarChecklist();
    } catch (err) {
      // Si falla, revertimos el estado visual
      setPlanes((prevPlanes) =>
        prevPlanes.map((plan) => ({
          ...plan,
          tareas: plan.tareas.map((t) =>
            t.id === tareaId ? { ...t, completado: completadoActual } : t
          ),
        }))
      );
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarea");
    } finally {
      setActualizandoId(null);
    }
  };

  return {
    checklistData,
    planes,
    loading,
    error,
    actualizandoId,
    toggleTarea,
    recargar: cargarChecklist,
  };
}