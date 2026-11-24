import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IngredienteForm } from "../IngredienteForm";
import { useIngredienteABM } from "../../hooks/useIngredienteABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { IngredienteInput } from "../../types/ingrediente";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuWheat } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

export function IngredienteCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const {
    alta,
    reactivar,
    conflicto,
    cancelarConflicto,
    loading,
    error,
  } = useIngredienteABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] =
    useState<IngredienteInput | null>(null);

  const handleSubmit = async (values: IngredienteInput) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/ingredientes");
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
      delayedNavigate("/ingredientes");
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
      volver={{ a: "/ingredientes", etiqueta: "Ingredientes" }}
      icono={LuWheat}
      titulo="Nuevo ingrediente"
      descripcion="Cargá la materia prima con su unidad de medida y si es un aditivo. Después, desde Modificar, cargás sus insumos (las marcas que se compran)."
    >
      {error && !conflicto && <BannerError>{error}</BannerError>}

      <IngredienteForm
        onSubmit={handleSubmit}
        isLoading={loading}
        submitLabel="Crear ingrediente"
        onCancel={() => navigate("/ingredientes")}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Ingrediente guardado correctamente."
      />

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