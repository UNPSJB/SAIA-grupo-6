import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import {
  listarCandidatas,
  listarSituacionesDisponibles,
} from "../services/planAccionService";
import type { SituacionDisponible } from "../types/planAccion";

// A nivel de módulo: `useLista` necesita una función de identidad estable.
const cargarDisponibles = () => listarSituacionesDisponibles();

/** Situaciones presentes que todavía no están en ningún plan activo. */
export function useSituacionesDisponibles() {
  const { items, loading, error } = useLista<SituacionDisponible[]>({
    cargar: cargarDisponibles,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las situaciones",
  });
  return { situaciones: items, loading, error };
}

/** Situaciones del mismo tipo que un plan en armado podría sumar. */
export function useCandidatas(planId: number, habilitado: boolean, version: number) {
  const cargar = useCallback(
    () => (habilitado ? listarCandidatas(planId) : Promise.resolve([])),
    [planId, habilitado],
  );
  const { items, loading, error } = useLista<SituacionDisponible[]>({
    cargar,
    dependencias: [planId, habilitado, version],
    valorInicial: [],
    mensajeError: "No se pudieron cargar las situaciones candidatas",
  });
  return { candidatas: items, loading, error };
}
