import { useABM } from "../../../common/hooks/useABM";
import {
  crearProveedor,
  eliminarProveedor,
  modificarProveedor,
  reactivarProveedor,
} from "../services/proveedorService";
import type { Proveedor, ProveedorFormValues } from "../types/proveedor";

type ProveedorInput = ProveedorFormValues;

export function useProveedorABM() {
  return useABM<ProveedorInput, Proveedor>({
    crear: crearProveedor,
    modificar: modificarProveedor,
    eliminar: eliminarProveedor,
    reactivar: reactivarProveedor,
    etiqueta: "el proveedor",
  });
}