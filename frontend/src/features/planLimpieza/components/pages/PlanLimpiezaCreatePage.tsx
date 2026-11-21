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
import { LuSparkles } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";

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
    <PaginaAlta
      volver={{ a: "/planes-limpieza", etiqueta: "Planes de limpieza" }}
      icono={LuSparkles}
      ancho="extenso"
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
        submitLabel="Crear plan"
        onCancel={() => navigate("/planes-limpieza")}
      />
    </PaginaAlta>
  );
}