import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { EquipoForm } from "../EquipoForm";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { Equipo } from "../../types/equipo";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

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
      <PageHeader
        title="Nuevo equipo"
        description="Cargá el equipo con su tipo y ubicación para poder Planes de Limpieza y calibraciones."
        actions={
          <BotonVolver onClick={() => navigate("/equipos")}>
            Volver a la lista
          </BotonVolver>
        }
      />

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
