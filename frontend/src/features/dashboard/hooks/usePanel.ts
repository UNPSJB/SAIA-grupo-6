import { useCallback, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { haceDiasISO, hoyISO } from "../../../common/utils/fechas";
import { obtenerPanel } from "../services/panelService";
import { PERIODO_INICIAL, type CategoriaPanel } from "../types/paneles";

export interface EstadoPanel<T> {
  /** `null` hasta que llega la primera respuesta. */
  datos: T | null;
  loading: boolean;
  error: string | null;
  /** Período elegido, en días hacia atrás (valor de `PERIODOS`). */
  dias: string;
  cambiarDias: (dias: string) => void;
  /** Valor del filtro propio del panel ("" = todos). */
  filtro: string;
  cambiarFiltro: (valor: string) => void;
  recargar: () => Promise<void>;
}

/**
 * Datos de un panel de categoría con su período y su filtro propio.
 *
 * Es un solo pedido al endpoint agregado. Al cambiar un filtro se vuelve a
 * pedir, y mientras tanto `datos` conserva lo anterior (así la pantalla no
 * parpadea entre un período y otro).
 *
 * @param parametro  nombre del query param del filtro propio (`sector_id`...).
 */
export function usePanel<T>(categoria: CategoriaPanel, parametro?: string): EstadoPanel<T> {
  const [dias, setDias] = useState<string>(PERIODO_INICIAL);
  const [filtro, setFiltro] = useState("");

  const cargar = useCallback(
    () =>
      obtenerPanel<T>(categoria, {
        // "Últimos 30 días" incluye hoy: se retrocede uno menos.
        desde: haceDiasISO(Number(dias) - 1),
        hasta: hoyISO(),
        extra: parametro && filtro ? { [parametro]: filtro } : undefined,
      }),
    [categoria, dias, filtro, parametro],
  );

  const { items, loading, error, recargar } = useLista<T | null>({
    cargar,
    dependencias: [],
    valorInicial: null,
    mensajeError: "No se pudieron cargar los indicadores",
    preferirMensajeDelBackend: true,
  });

  return {
    datos: items,
    loading,
    error,
    dias,
    cambiarDias: setDias,
    filtro,
    cambiarFiltro: setFiltro,
    recargar,
  };
}
