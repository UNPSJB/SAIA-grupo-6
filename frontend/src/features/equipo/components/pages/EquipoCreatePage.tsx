import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuWrench } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";
import { EquipoForm } from "../EquipoForm";
import { useEquipoABM } from "../../hooks/useEquipoABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { EquipoInput } from "../../types/equipo";
import { DialogoExito } from "../../../../components/ui/patrones";

export function EquipoCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { alta, loading, error } = useEquipoABM();
  const [exito, setExito] = useState(false);

  const handleSubmit = async (values: EquipoInput) => {
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
    <PaginaAlta
      volver={{ a: "/equipos", etiqueta: "Equipos" }}
      icono={LuWrench}
      titulo="Nuevo equipo"
      descripcion="Cargá el equipo con su tipo y sector para poder asignarle planes de limpieza y calibraciones."
      error={error}
    >

      <EquipoForm
        onSubmit={handleSubmit}
        isLoading={loading}
        submitLabel="Crear Equipo"
        onCancel={() => navigate("/equipos")}
      />

      <DialogoExito isOpen={exito} mensaje="Equipo agregado correctamente." />
    </PaginaAlta>
  );
}
