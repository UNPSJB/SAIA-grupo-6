import { useABM } from "../../../common/hooks/useABM";
import {
  crearTransportista,
  eliminarTransportista,
  modificarTransportista,
  reactivarTransportista,
} from "../services/transportistaService";
import type { Transportista, TransportistaFormValues } from "../types/transportista";

type TransportistaInput = TransportistaFormValues;

export function useTransportistaABM() {
  return useABM<TransportistaInput, Transportista>({
    crear: crearTransportista,
    modificar: modificarTransportista,
    eliminar: eliminarTransportista,
    reactivar: reactivarTransportista,
    etiqueta: "el transportista",
  });
}
