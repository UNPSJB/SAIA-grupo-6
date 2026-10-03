import { useState } from "react";
import {
  crearAptitud,
  modificarAptitud,
  eliminarAptitud,
  reactivarAptitud,
} from "../services/aptitudService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { Aptitud } from "../types/aptitud";

interface ConflictoInactivo {
  id: number;
  mensaje: string;
  campo: string;
}

export function useAptitudABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

  const alta = async (datos: Omit<Aptitud, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      return await crearAptitud(datos);
    } catch (err) {
      if (err instanceof ConflictoInactivoError) {
        setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
      } else {
        setError(err instanceof Error ? err.message : "No se pudo crear la aptitud");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivar = async (id: number, datos: Omit<Aptitud, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reactivarAptitud(id, datos);
      setConflicto(null);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reactivar la aptitud");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelarConflicto = () => setConflicto(null);

  const modificar = async (id: number, datos: Partial<Omit<Aptitud, "id">>) => {
    try {
      setLoading(true);
      setError(null);
      return await modificarAptitud(id, datos);
    } catch (err) {
      setError("No se pudo modificar la aptitud");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await eliminarAptitud(id);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo eliminar la aptitud";
      setError(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { alta, modificar, borrar, reactivar, conflicto, cancelarConflicto, loading, error };
}