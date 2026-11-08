import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

export function UnidadMedidaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useUnidadMedidaABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<UnidadMedida, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<UnidadMedida, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/unidades-medida");
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
      delayedNavigate("/unidades-medida");
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
      volver={{ a: "/unidades-medida", etiqueta: "Unidades de medida" }}
      titulo="Nueva unidad de medida"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <DialogoExito
        isOpen={exito}
        mensaje="Unidad de medida guardada correctamente."
      />

      <UnidadMedidaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de unidad de medida"
        submitLabel="Crear unidad de medida"
        onCancel={() => navigate("/unidades-medida")}
      />

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
