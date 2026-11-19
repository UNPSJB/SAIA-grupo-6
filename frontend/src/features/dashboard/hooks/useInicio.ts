import { useCallback, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { obtenerInicio } from "../services/panelService";
import type { PanelInicio } from "../types/paneles";

const SIN_DATOS: PanelInicio = {
  fecha: "",
  checklist: {
    total: 0,
    completadas: 0,
    porcentaje: null,
    meta: 100,
    por_momento: [],
    pendientes: [],
    pendientes_total: 0,
  },
  grupos: [],
  vencen_hoy: null,
};

/**
 * Últimos datos del inicio de cada usuario, en memoria mientras dure la
 * sesión en la pestaña. Al volver al Inicio (por ejemplo con el barrido entre
 * pantallas) la página aparece armada con lo último que se vio y se actualiza
 * por detrás, en vez de mostrar un lienzo vacío mientras carga.
 */
const cache = new Map<number, { datos: PanelInicio; actualizado: Date }>();

/**
 * Lo del día de hoy (checklist, producción, calidad y vencimientos). Un solo
 * pedido: el backend arma todo con los mismos cálculos de los paneles.
 * Con `habilitado` en false (sin permisos para el panel) no se pide nada.
 */
export function useInicio(habilitado: boolean, usuarioId: number | undefined) {
  const guardado = usuarioId === undefined ? undefined : cache.get(usuarioId);
  // Hora de la última respuesta, para mostrar qué tan frescas son las cifras.
  const [actualizado, setActualizado] = useState<Date | null>(guardado?.actualizado ?? null);

  const cargar = useCallback(
    () =>
      habilitado
        ? obtenerInicio().then((datos) => {
            const ahora = new Date();
            setActualizado(ahora);
            if (usuarioId !== undefined) cache.set(usuarioId, { datos, actualizado: ahora });
            return datos;
          })
        : Promise.resolve(SIN_DATOS),
    [habilitado, usuarioId],
  );

  const { items, loading, error, recargar } = useLista<PanelInicio>({
    cargar,
    dependencias: [habilitado, usuarioId],
    valorInicial: guardado?.datos ?? SIN_DATOS,
    mensajeError: "No se pudo cargar el estado de las áreas",
    preferirMensajeDelBackend: true,
  });

  return { inicio: items, loading, error, recargar, actualizado };
}
