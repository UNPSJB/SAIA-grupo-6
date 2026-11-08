import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { AptitudForm } from "../AptitudForm";
import { useAptitudABM } from "../../hooks/useAptitudABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { Aptitud } from "../../types/aptitud";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

export function AptitudCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useAptitudABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Aptitud, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Aptitud, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/aptitudes");
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
      volver={{ a: "/aptitudes", etiqueta: "Aptitudes" }}
      titulo="Nueva aptitud"
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <AptitudForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de aptitud"
        submitLabel="Crear aptitud"
        onCancel={() => navigate("/aptitudes")}
      />

      <DialogoExito isOpen={exito} mensaje="Aptitud agregada correctamente." />

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
