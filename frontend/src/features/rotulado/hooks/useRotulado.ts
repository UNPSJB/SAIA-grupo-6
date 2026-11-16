import { useCallback, useState } from "react";
import {
  autocompletarBorrador,
  actualizarBorrador,
  crearBorrador,
  eliminarBorrador,
  obtenerBorrador,
  listarBorradoresPorProducto,
} from "../services/rotuladoService";
import type {
  BorradorRotuladoCreate,
  BorradorRotuladoOut,
  BorradorRotuladoUpdate,
} from "../types/rotulado";

interface UseRotuladoReturn {
  borradores: BorradorRotuladoOut[];
  borrador: BorradorRotuladoOut | null;
  loading: boolean;
  error: string | null;
  listarBorradores: (productoId: number) => Promise<void>;
  obtenerBorrador: (borradorId: number) => Promise<void>;
  crearBorrador: (datos: BorradorRotuladoCreate) => Promise<BorradorRotuladoOut | null>;
  actualizarBorrador: (
    borradorId: number,
    datos: BorradorRotuladoUpdate,
  ) => Promise<BorradorRotuladoOut | null>;
  eliminarBorrador: (borradorId: number) => Promise<boolean>;
  autocompletarBorrador: (
    borradorId: number,
    versionId: number | null,
    loteId: number | null,
    forzar?: boolean,
  ) => Promise<BorradorRotuladoOut | null>;
}

export function useRotulado(): UseRotuladoReturn {
  const [borradores, setBorradores] = useState<BorradorRotuladoOut[]>([]);
  const [borrador, setBorrador] = useState<BorradorRotuladoOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listarBorradores = useCallback(
    async (productoId: number) => {
      setLoading(true);
      setError(null);
      try {
        const datos = await listarBorradoresPorProducto(productoId);
        setBorradores(datos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const obtenerBorradorById = useCallback(
    async (borradorId: number) => {
      setLoading(true);
      setError(null);
      try {
        const datos = await obtenerBorrador(borradorId);
        setBorrador(datos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const crear = useCallback(
    async (datos: BorradorRotuladoCreate) => {
      setLoading(true);
      setError(null);
      try {
        const resultado = await crearBorrador(datos);
        setBorradores((prev) => [...prev, resultado]);
        setBorrador(resultado);
        return resultado;
      } catch (err) {
        const mensaje =
          err instanceof Error ? err.message : "Error al crear el borrador";
        setError(mensaje);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const actualizar = useCallback(
    async (borradorId: number, datos: BorradorRotuladoUpdate) => {
      setLoading(true);
      setError(null);
      try {
        const resultado = await actualizarBorrador(borradorId, datos);
        setBorrador(resultado);
        setBorradores((prev) =>
          prev.map((b) => (b.id === borradorId ? resultado : b)),
        );
        return resultado;
      } catch (err) {
        const mensaje =
          err instanceof Error ? err.message : "Error al actualizar el borrador";
        setError(mensaje);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const eliminar = useCallback(
    async (borradorId: number) => {
      setLoading(true);
      setError(null);
      try {
        await eliminarBorrador(borradorId);
        setBorradores((prev) => prev.filter((b) => b.id !== borradorId));
        if (borrador?.id === borradorId) {
          setBorrador(null);
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [borrador],
  );

  const autocompletar = useCallback(
    async (
      borradorId: number,
      versionId: number | null,
      loteId: number | null,
      forzar = false,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const resultado = await autocompletarBorrador(borradorId, {
          version_id: versionId,
          lote_id: loteId,
          forzar,
        });
        setBorrador(resultado);
        setBorradores((prev) =>
          prev.map((b) => (b.id === borradorId ? resultado : b)),
        );
        return resultado;
      } catch (err) {
        const mensaje =
          err instanceof Error ? err.message : "Error al autocompletar";
        setError(mensaje);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    borradores,
    borrador,
    loading,
    error,
    listarBorradores,
    obtenerBorrador: obtenerBorradorById,
    crearBorrador: crear,
    actualizarBorrador: actualizar,
    eliminarBorrador: eliminar,
    autocompletarBorrador: autocompletar,
  };
}
