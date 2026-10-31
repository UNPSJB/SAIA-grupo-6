import { useState } from "react";
import { useABM } from "../../../common/hooks/useABM";
import {
  crearEquipo,
  modificarEquipo,
  eliminarEquipo,
  reactivarEquipo,
  registrarIntervencion,
} from "../services/equipoService";
import type { Calibracion, Equipo, TipoIntervencion,EquipoInput } from "../types/equipo";



export function useEquipoABM() {
  const abm = useABM<EquipoInput, Equipo>({
    crear: crearEquipo,
    modificar: modificarEquipo,
    eliminar: eliminarEquipo,
    reactivar: reactivarEquipo,
    etiqueta: "el equipo",
  });

  const [registrandoIntervencion, setRegistrandoIntervencion] = useState(false);
  const [errorIntervencion, setErrorIntervencion] = useState<string | null>(null);

  /**
   * Registra una intervención con su archivo adjunto.
   *
   * Va aparte del `useABM` porque no es un alta/baja de equipos: no usa el
   * `loading` global (que bloquea la tabla entera) sino el suyo, para que el
   * resto de la página siga funcionando mientras se sube el archivo.
   */
  const registrarIntervencionEquipo = async (
    equipoId: number,
    fecha: string,
    archivo: File,
    tipo: TipoIntervencion,
  ): Promise<Calibracion> => {
    setRegistrandoIntervencion(true);
    setErrorIntervencion(null);
    try {
      return await registrarIntervencion(equipoId, fecha, archivo, tipo);
    } catch (error) {
      setErrorIntervencion(
        error instanceof Error ? error.message : "No se pudo registrar la intervención.",
      );
      throw error;
    } finally {
      setRegistrandoIntervencion(false);
    }
  };

  return {
    ...abm,
    registrarIntervencion: registrarIntervencionEquipo,
    registrandoIntervencion,
    errorIntervencion,
  };
}
