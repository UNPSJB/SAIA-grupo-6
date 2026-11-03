/** Hook para exportar reportes de cualquier tabla.

Maneja el estado de carga, éxito y error de la descarga, sin conocer
tablas concretas. Se reutiliza desde cualquier página o componente.
*/

import { useState, useCallback } from "react";
import { exportarTabla, listarTablasExportables } from "../services/exportacionService";
import type { TablaExport, FormatoExport, FiltrosExport } from "../types/exportacion";

export interface EstadoExportacion {
  cargando: boolean;
  exito: boolean;
  error: string | null;
  tablas: TablaExport[];
}

/**
 * Devuelve funciones y estado para exportar tablas.
 *
 * Ejemplo:
 *   const { exportar, tablas, cargando, error } = useExportacion();
 *   await exportar("personal", "csv", { activo: "true" });
 */
export function useExportacion(): EstadoExportacion & {
  cargarTablas: () => Promise<void>;
  exportar: (
    nombreTabla: string,
    formato: FormatoExport,
    filtros?: FiltrosExport
  ) => Promise<void>;
} {
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablas, setTablas] = useState<TablaExport[]>([]);

  const cargarTablas = useCallback(async () => {
    try {
      const lista = await listarTablasExportables();
      setTablas(lista);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar tablas");
      setTablas([]);
    }
  }, []);

  const exportar = useCallback(
    async (nombreTabla: string, formato: FormatoExport, filtros: FiltrosExport = {}) => {
      setCargando(true);
      setExito(false);
      setError(null);
      try {
        await exportarTabla(nombreTabla, formato, filtros);
        setExito(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al exportar");
      } finally {
        setCargando(false);
      }
    },
    []
  );

  return {
    cargando,
    exito,
    error,
    tablas,
    cargarTablas,
    exportar,
  };
}
