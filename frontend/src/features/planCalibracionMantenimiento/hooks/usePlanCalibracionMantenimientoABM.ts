import { useCallback } from "react";

import { useABM } from "../../../common/hooks/useABM";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import {
  crearPlanCalibracionMantenimiento,
  eliminarPlanCalibracionMantenimiento,
  modificarPlanCalibracionMantenimiento,
} from "../services/planCalibracionMantenimientoService";
import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoCreate,
  PlanCalibracionMantenimientoUpdate,
} from "../types/planCalibracionMantenimiento";

/**
 * Antes este hook tenía su propio `alta`/`modificar` a mano y nada de borrado:
 * era el único feature de los 11 sin baja, aunque el modelo tiene `activo` y el
 * backend expone `DELETE /planes-calibracion-mantenimiento/{id}`.
 *
 * Ahora se apoya en `useABM`, igual que el resto, y agrega `borrar`.
 *
 * No hay `reactivar`: la reactivación de este catálogo no existe como endpoint
 * (a diferencia de los catálogos con colisión por nombre), así que se pasa una
 * función que falla de forma explícita en vez de exponer una acción que no
 * hace nada.
 */
export function usePlanCalibracionMantenimientoABM() {
  const reactivarNoSoportado = useCallback(async () => {
    throw new Error(
      "Reactivar un plan de calibración y mantenimiento no está soportado: " +
        "modificalo con un PUT para volver a activarlo.",
    );
  }, []);

  return useABM<PlanCalibracionMantenimientoCreate, PlanCalibracionMantenimiento>({
    crear: async (plan) => {
      const creado = await crearPlanCalibracionMantenimiento(plan);
      // El backend genera la notificación PROXIMO_A_VENCER al dar de alta, así
      // que la campana tiene que enterarse. Antes solo la avisaban las
      // mutaciones de elementoLimpieza y el badge quedaba desactualizado.
      notificarCambioNotificaciones();
      return creado;
    },
    modificar: async (
      id: number,
      plan: Partial<PlanCalibracionMantenimientoUpdate>,
    ) => {
      const modificado = await modificarPlanCalibracionMantenimiento(id, plan);
      notificarCambioNotificaciones();
      return modificado;
    },
    eliminar: async (id: number) => {
      const eliminado = await eliminarPlanCalibracionMantenimiento(id);
      // Dar de baja un plan puede resolver notificaciones por vencer.
      notificarCambioNotificaciones();
      return eliminado;
    },
    reactivar: reactivarNoSoportado,
    etiqueta: "el plan de calibración y mantenimiento",
  });
}