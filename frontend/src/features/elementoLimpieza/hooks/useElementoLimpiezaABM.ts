import { useState } from "react";
import {
  crearElementoLimpieza,
  modificarElementoLimpieza,
  darDeBajaElementoLimpieza,
} from "../services/elementoLimpiezaService";
import { ConflictoInactivoError } from "../../../common/api/errors";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

interface ConflictoInactivo {
  id: number;
  mensaje: string;
  campo: string;
}

type ElementoLimpiezaInput = Omit<
  ElementoLimpieza,
  "id" | "activo" | "estado_alerta"
>;

export function useElementoLimpiezaABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState<ConflictoInactivo | null>(null);

  const alta = async (elemento: ElementoLimpiezaInput) => {
    try {
      setLoading(true);
      setError(null);
      setConflicto(null);
      return await crearElementoLimpieza(elemento);
    } catch (err) {
      if (err instanceof ConflictoInactivoError) {
        setConflicto({
          id: err.entidadId,
          mensaje: err.message,
          campo: err.campo,
        });
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo crear el elemento de limpieza"
        );
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivar = async (
    id: number,
    elemento?: Partial<ElementoLimpiezaInput>
  ) => {
    try {
      setLoading(true);
      setError(null);
      // Si se pasan datos nuevos se actualizan, y siempre se marca activo: true
      const resultado = await modificarElementoLimpieza(id, {
        ...(elemento ?? {}),
        activo: true,
      });
      setConflicto(null);
      return resultado;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al reactivar el elemento de limpieza"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const cancelarConflicto = () => setConflicto(null);

  const modificar = async (
    id: number,
    elemento: Partial<ElementoLimpiezaInput>
  ) => {
    try {
      setLoading(true);
      setError(null);
      return await modificarElementoLimpieza(id, elemento);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo modificar el elemento de limpieza"
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      return await darDeBajaElementoLimpieza(id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el elemento de limpieza"
      );
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
