import { useState, useEffect, useCallback } from "react";
import {
  listarVencimientosDePersona,
  crearVencimiento,
  actualizarVencimiento,
  eliminarVencimiento,
} from "../services/vencimientoPersonalService";
import type { VencimientoPersonal } from "../types/vencimientoPersonal";

// Clave = aptitud_id, valor = fecha de vencimiento ("YYYY-MM-DD")
export type VencimientosPorAptitud = Record<number, string>;

export function useVencimientosPersonal(personaId: number | null) {
  const [vencimientos, setVencimientos] = useState<VencimientoPersonal[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!personaId) {
      setVencimientos([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const datos = await listarVencimientosDePersona(personaId);
      setVencimientos(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar vencimientos");
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargar]);

  const guardarVencimientos = async (
    idPersona: number,
    valores: VencimientosPorAptitud
  ) => {
    try {
      setGuardando(true);
      setError(null);

      const aptitudesEnValores = new Set(Object.keys(valores).map(Number));

      // Las que estaban cargadas antes pero ya no están en "valores" -> se dan de baja
      const aEliminar = vencimientos.filter(
        (v) => !aptitudesEnValores.has(v.aptitud_id)
      );

      // Las que están presentes (con fecha) -> se crean o actualizan
      const operaciones = Object.entries(valores)
        .filter(([, fecha]) => fecha)
        .map(([aptitudIdStr, fecha]) => {
          const aptitudId = Number(aptitudIdStr);
          const existente = vencimientos.find((v) => v.aptitud_id === aptitudId);
          return existente
            ? actualizarVencimiento(existente.id, { fecha_vencimiento: fecha })
            : crearVencimiento({ persona_id: idPersona, aptitud_id: aptitudId, fecha_vencimiento: fecha });
        });

      await Promise.all([
        ...operaciones,
        ...aEliminar.map((v) => eliminarVencimiento(v.id)),
      ]);

      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar los vencimientos");
      throw err;
    } finally {
      setGuardando(false);
    }
  };

  return { vencimientos, loading, guardando, error, guardarVencimientos, recargar: cargar };
}
