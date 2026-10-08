import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { InsumoForm } from "../InsumoForm";
import { useInsumoABM } from "../../hooks/useInsumoABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoFormValues } from "../../types/insumo";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

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
    useState<InsumoFormValues | null>(null);

  const handleSubmit = async (values: InsumoFormValues) => {
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
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nuevo insumo"
        actions={
          <BotonVolver onClick={() => navigate("/insumos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {error && !conflicto && <BannerError>{error}</BannerError>}

      <InsumoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de insumo"
        submitLabel="Crear insumo"
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
    </Box>
  );
}