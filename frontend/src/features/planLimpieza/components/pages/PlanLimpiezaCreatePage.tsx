import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, HStack } from "@chakra-ui/react";
import { PlanLimpiezaForm } from "../PlanLimpiezaForm";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { PlanLimpiezaInput } from "../../services/planLimpiezaService";
import { BannerError, BotonVolver, DialogoExito } from "../../../../components/ui/patrones";

export function PlanLimpiezaCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = usePlanLimpiezaABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: PlanLimpiezaInput) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/planes-limpieza");
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="650px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Nuevo Plan de Limpieza
        </Heading>
        <BotonVolver onClick={() => navigate("/planes-limpieza")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {error && <BannerError>{error}</BannerError>}

      <DialogoExito
        isOpen={exito}
        mensaje="Plan de limpieza agregado correctamente."
      />

      <PlanLimpiezaForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Plan de Limpieza"
        submitLabel="Crear plan"
      />
    </Box>
  );
}