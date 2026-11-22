import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { SectorForm } from "../SectorForm";
import { useSectorABM } from "../../hooks/useSectorABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import type { Sector } from "../../types/sector";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuLayoutGrid } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

export function SectorCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = useSectorABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] = useState<Omit<Sector, "id" | "activo"> | null>(null);

  const handleSubmit = async (values: Omit<Sector, "id" | "activo">) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/sectores");
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
    <PaginaAlta
      volver={{ a: "/sectores", etiqueta: "Sectores" }}
      icono={LuLayoutGrid}
      titulo="Nuevo sector"
      descripcion="Cargá un sector de la planta."
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <SectorForm
        onSubmit={handleSubmit}
        isLoading={loading}
        submitLabel="Crear sector"
        onCancel={() => navigate("/sectores")}
      />

      <DialogoExito isOpen={exito} mensaje="Sector agregado correctamente." />

      <ConfirmarReactivacionDialog
        isOpen={conflicto !== null}
        mensaje={conflicto?.mensaje ?? ""}
        isLoading={loading}
        onCancel={handleCancelarReactivacion}
        onConfirm={handleConfirmarReactivacion}
      />
    </PaginaAlta>
  );
}