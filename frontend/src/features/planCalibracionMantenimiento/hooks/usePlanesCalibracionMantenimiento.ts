import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarPlanesCalibracionMantenimiento } from "../services/planCalibracionMantenimientoService";
import type { PlanCalibracionMantenimiento } from "../types/planCalibracionMantenimiento";

export function usePlanesCalibracionMantenimiento(incluirInactivos = false) {
  const cargarPlanes = useCallback(
    () => listarPlanesCalibracionMantenimiento(incluirInactivos),
    [incluirInactivos],
  );

  const { items, loading, error, recargar } = useLista<PlanCalibracionMantenimiento[]>({
    cargar: cargarPlanes,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los planes de calibración y mantenimiento",
  });

  return { planes: items, loading, error, cargarPlanes: recargar };
}