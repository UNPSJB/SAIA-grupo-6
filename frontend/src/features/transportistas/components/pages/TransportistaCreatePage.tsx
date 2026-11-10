import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";
import { useTransportistaABM } from "../../hooks/useTransportistaABM";
import type { Transportista } from "../../types/transportista";
import { TransportistaForm } from "../TransportistaForm";

export function TransportistaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useTransportistaABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Transportista, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Transportista, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/transportistas");
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
      delayedNavigate("/transportistas");
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
      volver={{ a: "/transportistas", etiqueta: "Transportistas" }}
      titulo="Nuevo transportista"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <TransportistaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de transportista"
        submitLabel="Crear transportista"
        onCancel={() => navigate("/transportistas")}
      />

      <DialogoExito isOpen={exito} mensaje="Transportista agregado correctamente." />

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
