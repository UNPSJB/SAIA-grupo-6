import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useClienteABM } from "../../hooks/useClienteABM";
import type { Cliente } from "../../types/cliente";
import { ClienteForm } from "../ClienteForm";

export function ClienteCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useClienteABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Cliente, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Cliente, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/clientes");
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
      delayedNavigate("/clientes");
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
      volver={{ a: "/clientes", etiqueta: "Clientes" }}
      titulo="Nuevo cliente"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <ClienteForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de cliente"
        submitLabel="Crear cliente"
        onCancel={() => navigate("/clientes")}
      />

      <DialogoExito isOpen={exito} mensaje="Cliente agregado correctamente." />

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
