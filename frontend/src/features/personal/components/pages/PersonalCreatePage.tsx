import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PersonalForm } from "../PersonalForm";
import { usePersonalABM } from "../../hooks/usePersonalABM";
import { ConfirmarReactivacionDialog } from "../../../../common/components/ConfirmarReactivacionDialog";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { useAuth } from "../../../../common/context/useAuth";
import {
  esSuperAdmin,
  puedeAsignarAdministrar,
  puedeAsignarGerente,
} from "../../../../common/api/permissions";
import type { PersonaInput } from "../../types/personal";
import { VencimientosPersonalForm } from "../../../vencimientoPersonal/components/VencimientosPersonalForm";
import { useVencimientosPersonal, type VencimientosPorAptitud } from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { ConflictoInactivoError } from "../../../../common/api/errors";
import {
  BannerError,
  DialogoExito,
} from "../../../../components/ui/patrones";
import { LuUserPlus } from "react-icons/lu";
import { PaginaAlta } from "../../../../components/ui/formularios";



export function PersonalCreatePage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { user } = useAuth();
  const { alta, reactivar, conflicto, cancelarConflicto, loading, error } = usePersonalABM();
  const [exito, setExito] = useState(false);
  // Guardamos los valores que el usuario cargó para poder reutilizarlos
  // si confirma la reactivación (no se los volvemos a pedir).
  const [valoresPendientes, setValoresPendientes] = useState<PersonaInput | null>(null);
  // esto para alptitud
  const [vencimientos, setVencimientos] = useState<VencimientosPorAptitud>({});
  const { guardarVencimientos, error: errorVencimientos } = useVencimientosPersonal(null);

 const handleSubmit = async (values: PersonaInput) => {
    try {
      const nuevaPersona = await alta(values);
      if (Object.values(vencimientos).some(Boolean)) {
        await guardarVencimientos(nuevaPersona.id, vencimientos);
      }
      setExito(true);
      delayedNavigate("/personal");
    } catch (error) {
      if (error instanceof ConflictoInactivoError) {
        setValoresPendientes(values);
      }
    }
  };

  const handleConfirmarReactivacion = async () => {
    if (!conflicto || !valoresPendientes) return;
    try {
      const personaReactivada = await reactivar(conflicto.id, valoresPendientes);
      if (Object.values(vencimientos).some(Boolean)) {
        await guardarVencimientos(personaReactivada.id, vencimientos);
      }
      setValoresPendientes(null);
      setExito(true);
      delayedNavigate("/personal");
    } catch {
      // El error ya queda reflejado en usePersonalABM().error
    }
  };

  const handleCancelarReactivacion = () => {
    cancelarConflicto();
    setValoresPendientes(null);
  };

  return (
    <PaginaAlta
      volver={{ a: "/personal", etiqueta: "Personal" }}
      icono={LuUserPlus}
      titulo="Nuevo personal"
      descripcion='La contraseña inicial es su DNI; puede cambiarla desde "Mi perfil" al iniciar sesión.'
    >
      {/* El conflicto de "inactivo" no se muestra acá como cartel de error:
          se resuelve con el diálogo de reactivación de abajo */}
      {error && !conflicto && <BannerError>{error}</BannerError>}
      {errorVencimientos && <BannerError>{errorVencimientos}</BannerError>}

      <PersonalForm
        onSubmit={handleSubmit}
        isLoading={loading}
        submitLabel="Crear personal"
        puedeEditarCapacidades
        puedeAsignarSuperAdmin={esSuperAdmin(user)}
        puedeAsignarAdministrar={puedeAsignarAdministrar(user)}
        puedeAsignarGerente={puedeAsignarGerente(user)}
        onCancel={() => navigate("/personal")}
        extra={<VencimientosPersonalForm valores={vencimientos} onChange={setVencimientos} />}
      />
      <ConfirmarReactivacionDialog
        isOpen={conflicto !== null}
        mensaje={conflicto?.mensaje ?? ""}
        isLoading={loading}
        onCancel={handleCancelarReactivacion}
        onConfirm={handleConfirmarReactivacion}
      />

      <DialogoExito
        isOpen={exito}
        mensaje="Personal agregado correctamente. Su contraseña inicial es su DNI."
      />
    </PaginaAlta>
  );
}
