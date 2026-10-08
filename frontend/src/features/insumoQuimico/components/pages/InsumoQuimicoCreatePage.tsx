import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, HStack } from "@chakra-ui/react";
import { InsumoQuimicoForm } from "../InsumoQuimicoForm";
import { useInsumoQuimicoABM } from "../../hooks/useInsumoQuimicoABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { InsumoQuimicoFormValues } from "../../types/insumoQuimico";
import { BannerError, BotonVolver, DialogoExito } from "../../../../components/ui/patrones";

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
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Nuevo insumo químico
        </Heading>
        <BotonVolver onClick={() => navigate("/insumos-quimicos")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {error && !conflicto && <BannerError>{error}</BannerError>}

      <InsumoQuimicoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Insumo Químico"
        submitLabel="Crear insumo químico"
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
    </Box>
  );
}
