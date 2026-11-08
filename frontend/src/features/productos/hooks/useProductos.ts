import { useCallback } from "react";
import { useLista } from "../../../common/hooks/useLista";
import { listarProductos } from "../services/productoService";
import type { Producto } from "../types/producto";

export function useProductos(incluirInactivos = false, buscar = "") {
  const cargar = useCallback(
    () => listarProductos(incluirInactivos, buscar),
    [incluirInactivos, buscar],
  );

  const { items, loading, error, recargar } = useLista<Producto[]>({
    cargar,
    dependencias: [incluirInactivos, buscar],
    valorInicial: [],
    mensajeError: "No se pudieron cargar los productos",
  });

  return { productos: items, loading, error, cargarProductos: recargar };
}
