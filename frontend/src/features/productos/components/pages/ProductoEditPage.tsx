import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { useRegistro } from "../../../../common/hooks/useRegistro";
import {
  BannerError,
  DialogoExito,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { useProductoABM } from "../../hooks/useProductoABM";
import { obtenerProducto } from "../../services/productoService";
import type { ProductoFormValues } from "../../types/producto";
import { ProductoForm } from "../ProductoForm";

export function ProductoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const productoId = Number(id);

  const { registro: producto, loading: cargando, error: errorCarga } = useRegistro({
    cargar: obtenerProducto,
    id: Number.isFinite(productoId) ? productoId : null,
    etiqueta: "el producto",
  });
  const { modificar, loading: guardando, error: errorGuardado } = useProductoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: ProductoFormValues) => {
    try {
      await modificar(productoId, {
        nombre: values.nombre.trim(),
        descripcion: values.descripcion.trim() || null,
        unidad_medida_id: values.unidad_medida_id,
      });
      setExito(true);
      delayedNavigate("/productos");
    } catch {
      // El hook expone el error.
    }
  };

  return (
    <PaginaFormulario volver={{ a: "/productos", etiqueta: "Productos" }} titulo="Editar producto">
      {cargando && <EstadoCargando>Cargando datos del producto...</EstadoCargando>}
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}

      {!cargando && !errorCarga && producto && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}
          <ProductoForm
            key={producto.id}
            initialValues={{
              nombre: producto.nombre,
              descripcion: producto.descripcion ?? "",
              unidad_medida_id: producto.unidad_medida.id,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar producto"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/productos")}
          />
        </>
      )}

      <DialogoExito isOpen={exito} mensaje="Producto modificado correctamente." />
    </PaginaFormulario>
  );
}
