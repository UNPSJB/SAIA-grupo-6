import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { InsumoQuimicoForm } from "../InsumoQuimicoForm";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoQuimicoFormValues } from "../../types/insumoQuimico";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

export function InsumoQuimicoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const {
    alta,
    reactivar,
    conflicto,
    cancelarConflicto,
    loading,
    error,
  } = useInsumoQuimicoABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] =
    useState<InsumoQuimicoFormValues | null>(null);

  const handleSubmit = async (values: InsumoQuimicoFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/insumos-quimicos");
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
      delayedNavigate("/insumos-quimicos");
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
      volver={{ a: "/insumos-quimicos", etiqueta: "Insumos químicos" }}
      titulo="Nuevo insumo químico"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <InsumoQuimicoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de insumo químico"
        submitLabel="Crear insumo químico"
        onCancel={() => navigate("/insumos-quimicos")}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Insumo químico agregado correctamente."
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
