import { useCallback, useMemo, useState } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import {
  fijarImpactoSituacion,
  obtenerImpactoSituaciones,
  restaurarImpactoSituacion,
} from "../services/configuracionService";
import type { ImpactoSituacion } from "../types/configuracion";

/**
 * Impacto (criticidad) de cada tipo de situación del motor de riesgos, para la
 * página "Configuración".
 *
 * Cada cambio se guarda en el momento y deja en pantalla lo que confirmó el
 * servidor. También avisa a la campana de notificaciones: los puntajes de
 * riesgo se recalculan con el nuevo impacto.
 */
export function useImpactoSituaciones() {
  const {
    items: cargados,
    loading: cargando,
    error: errorCarga,
    recargar,
  } = useLista<ImpactoSituacion[]>({
    cargar: obtenerImpactoSituaciones,
    dependencias: [],
    valorInicial: [],
    mensajeError: "No se pudo cargar el impacto de los eventos.",
    preferirMensajeDelBackend: true,
  });

  // Lo último que confirmó el servidor, por tipo. `useLista` no expone un
  // setter, y recargar tras cada cambio haría desaparecer la tabla un instante.
  const [confirmados, setConfirmados] = useState<Record<string, ImpactoSituacion>>({});
  const [guardandoTipo, setGuardandoTipo] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const impactos = useMemo(
    () => cargados.map((i) => confirmados[i.tipo] ?? i),
    [cargados, confirmados],
  );

  const aplicar = useCallback(
    async (
      tipo: string,
      pedir: () => Promise<ImpactoSituacion>,
      mensaje: (i: ImpactoSituacion) => string,
    ) => {
      try {
        setGuardandoTipo(tipo);
        setErrorGuardado(null);
        setExito(null);
        const actualizado = await pedir();
        setConfirmados((previos) => ({ ...previos, [tipo]: actualizado }));
        setExito(mensaje(actualizado));
        notificarCambioNotificaciones();
      } catch (e) {
        setErrorGuardado(
          e instanceof Error ? e.message : "No se pudo guardar el impacto.",
        );
      } finally {
        setGuardandoTipo(null);
      }
    },
    [],
  );

  const cambiar = useCallback(
    (tipo: string, impacto: number) =>
      aplicar(
        tipo,
        () => fijarImpactoSituacion(tipo, impacto),
        (i) => `Impacto de “${i.etiqueta}” guardado.`,
      ),
    [aplicar],
  );

  const restaurar = useCallback(
    (tipo: string) =>
      aplicar(
        tipo,
        () => restaurarImpactoSituacion(tipo),
        (i) => `Impacto de “${i.etiqueta}” restaurado al sugerido.`,
      ),
    [aplicar],
  );

  return {
    impactos,
    cargando,
    errorCarga,
    recargar,
    guardandoTipo,
    errorGuardado,
    exito,
    cambiar,
    restaurar,
  };
}
