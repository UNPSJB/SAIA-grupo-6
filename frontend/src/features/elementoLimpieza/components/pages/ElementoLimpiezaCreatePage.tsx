import type { ElementoLimpiezaFormValues } from "../../types/elementoLimpieza";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { ElementoLimpiezaForm } from "../ElementoLimpiezaForm";
import { useElementoLimpiezaABM } from "../../hooks/useElementoLimpiezaABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

export function ElementoLimpiezaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } =
    useElementoLimpiezaABM();
  const [exito, setExito] = useState(false);
  const [valoresPendientes, setValoresPendientes] =
    useState<ElementoLimpiezaFormValues | null>(null);

  const handleSubmit = async (values: ElementoLimpiezaFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/elementos-limpieza");
    } catch {
      // Guardamos los valores por si el usuario decide confirmar la reactivación
      setValoresPendientes(values);
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      await reactivar(conflicto.id, valoresPendientes);
      setValoresPendientes(null);
      setExito(true);
      delayedNavigate("/elementos-limpieza");
    } catch {
      // El error queda expuesto en useElementoLimpiezaABM().error
    }
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nuevo elemento de limpieza"
        actions={
          <BotonVolver onClick={() => navigate("/elementos-limpieza")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {error && !conflicto && <BannerError>{error}</BannerError>}

      <ElementoLimpiezaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de elemento de limpieza"
        submitLabel="Crear elemento"
        onCancel={() => navigate("/elementos-limpieza")}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Elemento de limpieza agregado correctamente."
      />

      {/* Modal de reactivación cuando se intenta dar de alta un registro inactivo */}
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
