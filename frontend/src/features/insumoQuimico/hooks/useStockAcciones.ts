import { useState } from "react";
import {
  actualizarStockMinimo,
  registrarAjusteStock,
  registrarIngresoStock,
} from "../services/stockService";
import type { OperacionAjusteStock } from "../types/stock";

export function useStockAcciones() {
  const [loading, setLoading] = useState(false);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setLoading(true);
    try {
      await accion();
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    actualizarMinimo: (id: number, stockMinimo: string | null) =>
      ejecutar(() => actualizarStockMinimo(id, stockMinimo)),
    registrarIngreso: (id: number, cantidad: string, proveedorId: number, numeroLote: string) =>
      ejecutar(() => registrarIngresoStock(id, cantidad, proveedorId, numeroLote)),
    registrarAjuste: (
      id: number,
      cantidad: string,
      operacion: OperacionAjusteStock,
      motivo: string,
    ) => ejecutar(() => registrarAjusteStock(id, cantidad, operacion, motivo)),
  };
}
