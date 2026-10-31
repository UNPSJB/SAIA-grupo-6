import { useABM } from "../../../common/hooks/useABM";
import {
  crearProveedor,
  eliminarProveedor,
  modificarProveedor,
  reactivarProveedor,
} from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

type ProveedorInput = Omit<Proveedor, "id" | "activo">;

export function useProveedorABM() {
  return useABM<ProveedorInput, Proveedor>({
    crear: crearProveedor,
    modificar: modificarProveedor,
    eliminar: eliminarProveedor,
    reactivar: reactivarProveedor,
    etiqueta: "el proveedor",
  });
}
