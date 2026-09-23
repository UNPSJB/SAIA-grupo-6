import { useState } from "react";
import {
  crearInsumoQuimico,
  modificarInsumoQuimico,
  eliminarInsumoQuimico,
  reactivarInsumoQuimico,
} from "../services/insumoQuimicoService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { InsumoQuimico } from "../types/insumoQuimico";

interface ConflictoInactivo {
  id: number;
  mensaje: string;
  campo: string;
}

export function useInsumoQuimicoABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

  const alta = async (datos: Omit<InsumoQuimico, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      return await crearInsumoQuimico(datos);
    } catch (err) {
      if (err instanceof ConflictoInactivoError) {
        setConflicto({ id: err.entidadId, mensaje: err.message, campo: err.campo });
      } else {
        setError(err instanceof Error ? err.message : "No se pudo crear el insumo químico");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivar = async (id: number, datos: Omit<InsumoQuimico, "id" | "activo">) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reactivarInsumoQuimico(id, datos);
      setConflicto(null);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reactivar el insumo químico");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelarConflicto = () => setConflicto(null);

  const modificar = async (id: number, datos: Partial<Omit<InsumoQuimico, "id">>) => {
    try {
      setLoading(true);
      setError(null);
      return await modificarInsumoQuimico(id, datos);
    } catch (err) {
      setError("No se pudo modificar el insumo químico");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await eliminarInsumoQuimico(id);
    } catch (err) {
      setError("No se pudo eliminar el insumo químico");
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
