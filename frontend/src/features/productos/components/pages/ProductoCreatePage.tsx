import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";
import { useProductoABM } from "../../hooks/useProductoABM";
import type { ProductoFormValues, ProductoInput } from "../../types/producto";
import { ProductoForm } from "../ProductoForm";

function aInput(values: ProductoFormValues): ProductoInput {
  return {
    nombre: values.nombre.trim(),
    descripcion: values.descripcion.trim() || null,
    unidad_medida_id: values.unidad_medida_id,
  };
}

export function ProductoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useProductoABM();
  const [exito, setExito] = useState(false);
  const [pendiente, setPendiente] = useState<ProductoInput | null>(null);

  const handleSubmit = async (values: ProductoFormValues) => {
    const datos = aInput(values);
    try {
      await alta(datos);
      setExito(true);
      delayedNavigate("/productos");
    } catch {
      setPendiente(datos);
    }
  };

  const confirmarReactivacion = async () => {
    if (!conflicto || !pendiente) return;
    try {
      await reactivar(conflicto.id, pendiente);
      setPendiente(null);
      setExito(true);
      delayedNavigate("/productos");
    } catch {
      // El hook expone el error.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nuevo producto"
        actions={<BotonVolver onClick={() => navigate("/productos")}>Volver a la lista</BotonVolver>}
      />

      {error && !conflicto && <BannerError>{error}</BannerError>}

      <ProductoForm onSubmit={handleSubmit} isLoading={loading} submitLabel="Crear producto" />

      <DialogoExito isOpen={exito} mensaje="Producto agregado correctamente." />

      <ConfirmarReactivacionDialog
        isOpen={conflicto !== null}
        mensaje={conflicto?.mensaje ?? ""}
        isLoading={loading}
        onCancel={() => {
          cancelarConflicto();
          setPendiente(null);
        }}
        onConfirm={confirmarReactivacion}
      />
    </Box>
  );
}
