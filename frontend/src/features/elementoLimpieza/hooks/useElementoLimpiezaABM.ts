import { useABM } from "../../../common/hooks/useABM";
import { notificarCambioNotificaciones } from "../../notificaciones/eventoNotificaciones";
import {
  crearElementoLimpieza,
  modificarElementoLimpieza,
  darDeBajaElementoLimpieza,
} from "../services/elementoLimpiezaService";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

type ElementoLimpiezaInput = Omit<ElementoLimpieza, "id" | "activo">;

// Función auxiliar para gritarle a la campanita que algo en la BD cambió
const avisarCampana = () => notificarCambioNotificaciones();

export function useElementoLimpiezaABM() {
  return useABM<ElementoLimpiezaInput, ElementoLimpieza>({
    // Los tres services avisan a la campanita recién cuando el backend confirmó
    // el cambio, así que el aviso va adentro de cada operación.
    crear: async (elemento) => {
      const creado = await crearElementoLimpieza(elemento);
      avisarCampana();
      return creado;
    },
    modificar: async (id, elemento) => {
      const modificado = await modificarElementoLimpieza(id, elemento);
      avisarCampana();
      return modificado;
    },
    eliminar: async (id) => {
      const dadoDeBaja = await darDeBajaElementoLimpieza(id);
      avisarCampana();
      return dadoDeBaja;
    },
    // No hay endpoint de reactivación: se reutiliza el PATCH mandando
    // `activo: true`, y desde el listado se reactiva sin tocar ningún campo.
    reactivar: async (id, elemento) => {
      const reactivado = await modificarElementoLimpieza(id, {
        ...(elemento ?? {}),
        activo: true,
      });
      avisarCampana();
      return reactivado;
    },
    etiqueta: "el elemento de limpieza",
  });
}