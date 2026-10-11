import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

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
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nueva unidad de medida"
        actions={
          <BotonVolver onClick={() => navigate("/unidades-medida")}>
            Volver a la lista
          </BotonVolver>
        }
      />

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
