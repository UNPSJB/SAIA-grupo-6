import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Box } from "@chakra-ui/react";

import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoForm } from "../PlanCalibracionMantenimientoForm";
import type { PlanCalibracionMantenimientoFormValues } from "../../types/planCalibracionMantenimiento";
import {
  BannerError,
  BotonVolver,
  DialogoExito,
  PageHeader,
} from "../../../../components/ui/patrones";

export function PlanCalibracionMantenimientoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = usePlanCalibracionMantenimientoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: PlanCalibracionMantenimientoFormValues) => {
    try {
      await alta(values);
      setExito(true);
      delayedNavigate("/planes-calibracion-mantenimiento");
    } catch {
      // El error queda expuesto por usePlanCalibracionMantenimientoABM().error.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <PageHeader
        title="Nuevo plan de calibración/mantenimiento"
        description="Asociá un plan de calibración o de mantenimiento a un equipo."
        actions={
          <BotonVolver onClick={() => navigate("/planes-calibracion-mantenimiento")}>
            Volver a la lista
          </BotonVolver>
        }
      />

      {error && <BannerError>{error}</BannerError>}

      <DialogoExito
        isOpen={exito}
        mensaje="Plan creado correctamente."
      />

      <PlanCalibracionMantenimientoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        title="Alta de Plan de Calibración/Mantenimiento"
        submitLabel="Crear plan"
        onCancel={() => navigate("/planes-calibracion-mantenimiento")}
      />
    </Box>
  );
}