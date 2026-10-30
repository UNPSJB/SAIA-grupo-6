import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarProveedores } from "../services/proveedorService";
import type { Proveedor } from "../types/proveedor";

export function useProveedores(incluirInactivos = false) {
  const cargarProveedores = useCallback(
    () => listarProveedores(incluirInactivos),
    [incluirInactivos]
  );

  const { items, loading, error, recargar } = useLista<Proveedor[]>({
    cargar: cargarProveedores,
    dependencias: [incluirInactivos],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los proveedores",
  });

  return { proveedores: items, loading, error, cargarProveedores: recargar };
}
