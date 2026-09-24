import { useState } from "react";
import {
  crearElementoLimpieza,
  modificarElementoLimpieza,
  darDeBajaElementoLimpieza,
} from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

export function useElementoLimpiezaABM() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alta = async (
    elemento: Omit<ElementoLimpieza, "id" | "activo" | "estado_alerta">
  ) => {
    try {
      setLoading(true);
      setError(null);

      return await crearElementoLimpieza(elemento);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el elemento de limpieza");
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const modificar = async (
    id: number,
    elemento: Partial<Omit<ElementoLimpieza, "id" | "activo" | "estado_alerta">>
  ) => {
    try {
      setLoading(true);
      setError(null);

      return await modificarElementoLimpieza(id, elemento);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo modificar el elemento de limpieza"
      );
      console.error(err);
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
        err instanceof Error ? err.message : "No se pudo eliminar el elemento de limpieza"
      );
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reactivar = async (
    elemento: Omit<ElementoLimpieza, "id" | "activo" | "estado_alerta">
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Reutiliza el endpoint crearElementoLimpieza que en el backend 
      // ya resuelve la reactivación si el registro existía inactivo.
      return await crearElementoLimpieza(elemento);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al reactivar el elemento de limpieza"
      );
      console.error(err);
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
    loading,
    error,
  };
}