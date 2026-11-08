import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useProveedorABM } from "../../hooks/useProveedorABM";
import type { Proveedor } from "../../types/proveedor";
import { ProveedorForm } from "../ProveedorForm";

export function ProveedorCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useProveedorABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Proveedor, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Proveedor, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/proveedores");
    } catch {
      setValoresPendientes(values);
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      await reactivar(conflicto.id, valoresPendientes);
      setValoresPendientes(null);
      setExito(true);
      delayedNavigate("/proveedores");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <PaginaFormulario
      volver={{ a: "/proveedores", etiqueta: "Proveedores" }}
      titulo="Nuevo proveedor"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <ProveedorForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de proveedor"
        submitLabel="Crear proveedor"
        onCancel={() => navigate("/proveedores")}
      />

      <DialogoExito isOpen={exito} mensaje="Proveedor agregado correctamente." />

      <ConfirmarReactivacionDialog
        isOpen={conflicto !== null}
        mensaje={conflicto?.mensaje ?? ""}
        isLoading={loading}
        onCancel={handleCancelarReactivacion}
        onConfirm={handleConfirmarReactivacion}
      />
    </PaginaFormulario>
  );
}
