import { useABM } from "../../../common/hooks/useABM";
import {
  crearTransportista,
  eliminarTransportista,
  modificarTransportista,
  reactivarTransportista,
} from "../services/transportistaService";
import type { Transportista } from "../types/transportista";

type TransportistaInput = Omit<Transportista, "id" | "activo">;

export function useTransportistaABM() {
  return useABM<TransportistaInput, Transportista>({
    crear: crearTransportista,
    modificar: modificarTransportista,
    eliminar: eliminarTransportista,
    reactivar: reactivarTransportista,
    etiqueta: "el transportista",
  });
}
