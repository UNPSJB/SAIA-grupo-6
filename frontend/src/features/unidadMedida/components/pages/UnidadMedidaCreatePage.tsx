import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Heading, HStack } from "@chakra-ui/react";
import { UnidadMedidaForm } from "../UnidadMedidaForm";
import { useUnidadMedidaABM } from "../../hooks/useUnidadMedidaABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { UnidadMedida } from "../../types/unidadMedida";
import { BannerError, DialogoExito } from "../../../../components/ui/patrones";

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
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Nueva unidad de medida
        </Heading>
        <Button
          colorPalette="gray"
          fontSize="md"
          fontWeight="normal"
          h="auto"
          minW="auto"
          px="4"
          py="2"
          rounded="md"
          onClick={() => navigate("/unidades-medida")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {error && !conflicto && <BannerError>{error}</BannerError>}

      {exito && <DialogoExito isOpen={exito} mensaje="Unidad de medida guardada correctamente." />}

      <UnidadMedidaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Unidad de Medida"
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
