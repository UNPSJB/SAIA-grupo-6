import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlanLimpiezaForm } from "../PlanLimpiezaForm";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { PlanLimpiezaInput } from "../../services/planLimpiezaService";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

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
    <PaginaFormulario
      volver={{ a: "/planes-limpieza", etiqueta: "Planes de limpieza" }}
      titulo="Nuevo Plan de Limpieza"
      descripcion="Definí las tareas, con qué frecuencia se repiten y a qué equipo aplican."
    >
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
        onCancel={() => navigate("/planes-limpieza")}
      />
    </PaginaFormulario>
  );
}