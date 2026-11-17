import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InsumoForm } from "../InsumoForm";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoInput } from "../../types/insumo";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

export function InsumoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const {
    alta,
    reactivar,
    conflicto,
    cancelarConflicto,
    loading,
    error,
  } = useInsumoABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] =
    useState<InsumoInput | null>(null);

  const handleSubmit = async (values: InsumoInput) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/insumos");
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
      delayedNavigate("/insumos");
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
      volver={{ a: "/insumos", etiqueta: "Insumos" }}
      titulo="Nuevo insumo"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <InsumoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de insumo"
        submitLabel="Crear insumo"
        onCancel={() => navigate("/insumos")}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Insumo guardado correctamente."
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