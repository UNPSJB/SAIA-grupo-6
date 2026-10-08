import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Heading, HStack } from "@chakra-ui/react";
import { EquipoForm } from "../EquipoForm";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { Equipo } from "../../types/equipo";
import { BannerError, BotonVolver, DialogoExito } from "../../../../components/ui/patrones";

export function EquipoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = useEquipoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: Omit<Equipo, "id">) => {
    try {
      await alta(values);
      setExito(true);
      // Espera 2 segundos para que el usuario lea el cartel antes de volver a la lista
      delayedNavigate("/equipos");
    } catch {
      // El error ya queda reflejado en useEquipoABM().error
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Nuevo equipo
        </Heading>
        <BotonVolver onClick={() => navigate("/equipos")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {error && <BannerError>{error}</BannerError>}

      <EquipoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Equipo"
        submitLabel="Crear Equipo"
      />

      <DialogoExito isOpen={exito} mensaje="Equipo agregado correctamente." />
    </Box>
  );
}
