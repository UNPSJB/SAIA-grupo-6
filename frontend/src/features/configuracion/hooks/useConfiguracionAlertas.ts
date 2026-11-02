import { useCallback, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import {
  actualizarConfiguracionAlertas,
  obtenerConfiguracionAlertas,
} from "../services/configuracionService";
import type { ConfiguracionAlertas } from "../types/configuracion";

/**
 * Configuración de las alertas, para la página "Configuración".
 *
 * Carga con `useLista` (mismo manejo de carreras y de StrictMode que el resto
 * de los listados) y suma el guardado: `guardar` pide el cambio al backend,
 * deja en `configuracion` el valor confirmado por el servidor y avisa a la
 * campana de notificaciones, porque las alertas de vencimiento se recalculan
 * con el nuevo margen de días.
 */
export function useConfiguracionAlertas() {
  const {
    items: cargada,
    loading: cargando,
    error: errorCarga,
    recargar,
  } = useLista<ConfiguracionAlertas | null>({
    cargar: obtenerConfiguracionAlertas,
    dependencias: [],
    valorInicial: null,
    mensajeError: "No se pudo cargar la configuración.",
    preferirMensajeDelBackend: true,
  });

  // Lo último que confirmó el servidor al guardar. `useLista` no expone un
  // setter, y recargar tras guardar haría desaparecer el formulario un
  // instante (vuelve a `loading`).
  const [guardada, setGuardada] = useState<ConfiguracionAlertas | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const guardar = useCallback(async (dias: number): Promise<boolean> => {
    try {
      setGuardando(true);
      setErrorGuardado(null);
      setExito(null);
      const actualizada = await actualizarConfiguracionAlertas(dias);
      setGuardada(actualizada);
      setExito("Configuración guardada correctamente.");
      notificarCambioNotificaciones();
      return true;
    } catch (e) {
      setErrorGuardado(
        e instanceof Error ? e.message : "No se pudo guardar la configuración.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }, []);

  /** Borra el mensaje de éxito/error cuando la persona vuelve a editar. */
  const limpiarMensajes = useCallback(() => {
    setErrorGuardado(null);
    setExito(null);
  }, []);

  return {
    configuracion: guardada ?? cargada,
    cargando,
    errorCarga,
    recargar,
    guardando,
    errorGuardado,
    exito,
    guardar,
    limpiarMensajes,
  };
}
