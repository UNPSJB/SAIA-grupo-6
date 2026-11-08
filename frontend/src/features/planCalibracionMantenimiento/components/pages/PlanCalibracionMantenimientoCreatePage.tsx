import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";

import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoForm } from "../PlanCalibracionMantenimientoForm";
import type { PlanCalibracionMantenimientoFormValues } from "../../types/planCalibracionMantenimiento";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

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
    <PaginaFormulario
      volver={{ a: "/planes-calibracion-mantenimiento", etiqueta: "Calibración y mantenimiento" }}
      titulo="Nuevo plan de calibración/mantenimiento"
      descripcion="Asociá un plan de calibración o de mantenimiento a un equipo."
    >
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
    </PaginaFormulario>
  );
}