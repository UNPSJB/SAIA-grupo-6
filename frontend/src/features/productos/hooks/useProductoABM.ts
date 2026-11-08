import { useABM } from "../../../common/hooks/useABM";
import {
  crearProducto,
  eliminarProducto,
  modificarProducto,
  reactivarProducto,
} from "../services/productoService";
import type { Producto, ProductoInput } from "../types/producto";

export function useProductoABM() {
  return useABM<ProductoInput, Producto>({
    crear: crearProducto,
    modificar: modificarProducto,
    eliminar: eliminarProducto,
    reactivar: reactivarProducto,
    etiqueta: "el producto",
  });
}
