import { useRegistro } from "../../../common/hooks/useRegistro";
import { obtenerProveedor } from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

export function useProveedor(id: number | null) {
  const { registro, loading, error } = useRegistro<Proveedor>({
    cargar: obtenerProveedor,
    id,
    etiqueta: "el proveedor",
  });

  return { proveedor: registro, loading, error };
}
