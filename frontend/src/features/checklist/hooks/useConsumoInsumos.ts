import { useState } from "react";
import { apiFetch, API_URL } from "../../../common/api/apiClient";
import type { ConsumoInsumosResponse } from "../types/checklist";

const hoyISO = (): string => {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
};

const haceDiasISO = (dias: number): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

/**
 * Consumo acumulado de productos de limpieza en un rango de fechas.
 * Solo accesible para usuarios con permiso de administrar.
 */
export function useConsumoInsumos() {
  const [fechaDesde, setFechaDesde] = useState(haceDiasISO(30));
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [data, setData] = useState<ConsumoInsumosResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = async (desde = fechaDesde, hasta = fechaHasta) => {
    if (!desde || !hasta) return;

    if (desde > hasta) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ fecha_desde: desde, fecha_hasta: hasta });
      const response = await apiFetch(`${API_URL}/checklist/consumo?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Error al obtener el consumo");
      }

      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al obtener el consumo");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    fechaDesde,
    fechaHasta,
    setFechaDesde,
    setFechaHasta,
    consumo: data,
    loading,
    error,
    cargar,
  };
}