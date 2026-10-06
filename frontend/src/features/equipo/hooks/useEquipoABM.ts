import { useState } from "react";
import { useABM } from "../../../common/hooks/useABM";
import {
  crearEquipo,
  modificarEquipo,
  eliminarEquipo,
  reactivarEquipo,
  registrarCalibracion,
} from "../services/equipoService";
import type { Calibracion, Equipo } from "../types/equipo";

type EquipoInput = Omit<Equipo, "id">;

export function useEquipoABM() {
  const abm = useABM<EquipoInput, Equipo>({
    crear: crearEquipo,
    modificar: modificarEquipo,
    eliminar: eliminarEquipo,
    reactivar: reactivarEquipo,
    etiqueta: "el equipo",
  });

  const [registrandoCalibracion, setRegistrandoCalibracion] = useState(false);

  /**
   * Registra una calibración con su certificado.
   *
   * Va aparte del `useABM` porque no es un alta/baja de equipos: no usa el
   * `loading` global (que bloquea la tabla entera) sino el suyo, para que el
   * resto de la página siga funcionando mientras se sube el archivo.
   */
  const calibrar = async (
    equipoId: number,
    fecha: string,
    archivo: File
  ): Promise<Calibracion> => {
    setRegistrandoCalibracion(true);
    try {
      return await registrarCalibracion(equipoId, fecha, archivo);
    } finally {
      setRegistrandoCalibracion(false);
    }
  };

  return {
    ...abm,
    calibrar,
    registrandoCalibracion,
  };
}