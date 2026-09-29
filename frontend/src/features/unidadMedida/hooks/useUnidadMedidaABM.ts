import { useState } from "react";
import {
  crearUnidadMedida,
  modificarUnidadMedida,
  eliminarUnidadMedida,
  reactivarUnidadMedida,
} from "../services/unidadMedidaService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { UnidadMedida } from "../types/unidadMedida";

interface ConflictoInactivo {
  id: number;
  mensaje: string;
  campo: string;
}

export function useUnidadMedidaABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

  const alta = async (datos: Omit<UnidadMedida, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      return await crearUnidadMedida(datos);
    } catch (err) {
      if (err instanceof ConflictoInactivoError) {
        setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
      } else {
        setError(err instanceof Error ? err.message : "No se pudo crear la unidad de medida");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivar = async (id: number, datos: Omit<UnidadMedida, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reactivarUnidadMedida(id, datos);
      setConflicto(null);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reactivar la unidad de medida");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelarConflicto = () => setConflicto(null);

  const modificar = async (id: number, datos: Partial<Omit<UnidadMedida, "id">>) => {
    try {
      setLoading(true);
      setError(null);
      return await modificarUnidadMedida(id, datos);
    } catch (err) {
      setError("No se pudo modificar la unidad de medida");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await eliminarUnidadMedida(id);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo eliminar la unidad de medida";
      setError(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    alta,
    modificar,
    borrar,
    reactivar,
    conflicto,
    cancelarConflicto,
    loading,
    error,
  };
}
