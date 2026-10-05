import { useCallback, useEffect, useState } from "react";

import { listarPlanesCalibracionMantenimiento } from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

export function usePlanesCalibracionMantenimiento(incluirInactivos = false) {
  const [planes, setPlanes] = useState<PlanCalibracionMantenimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarPlanes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listarPlanesCalibracionMantenimiento(incluirInactivos);
      setPlanes(data);
    } catch (err) {
      setError("No se pudieron cargar los planes de calibración y mantenimiento");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [incluirInactivos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargarPlanes, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargarPlanes]);

  return { planes, loading, error, cargarPlanes };
}
