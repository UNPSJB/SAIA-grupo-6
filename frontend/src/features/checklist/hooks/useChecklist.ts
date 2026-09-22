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

  const toggleTarea = async (tareaId: number, completadoActual: boolean) => {
    try {
      setActualizandoId(tareaId);
      const nuevoEstado = !completadoActual;

      setPlanes((prevPlanes) =>
        prevPlanes.map((plan) => ({
          ...plan,
          tareas: plan.tareas.map((t) =>
            t.id === tareaId ? { ...t, completado: nuevoEstado } : t
          ),
        }))
      );

      await marcarTarea(tareaId, { completado: nuevoEstado }, fecha);
    } catch (err) {
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