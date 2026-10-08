import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";

import { PersonalForm } from "../PersonalForm";
import { usePersonal } from "../../hooks/usePersonal";
import { usePersonalABM } from "../../hooks/usePersonalABM";

import { useAuth } from "../../../../common/context/useAuth";
import {
  esSuperAdmin,
  puedeModificarRoles,
} from "../../../../common/api/permissions";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";

import type { PersonaInput } from "../../types/personal";

import {
  useVencimientosPersonal,
  type VencimientosPorAptitud,
} from "../../../vencimientoPersonal/hooks/useVencimientosPersonal";
import { VencimientosPersonalForm } from "../../../vencimientoPersonal/components/VencimientosPersonalForm";
import { BannerError, BotonVolver, DialogoExito } from "../../../../components/ui/patrones";

export function PersonalEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();

  const { id } = useParams<{ id: string }>();
  const personaId = Number(id);

  // Usuario actualmente autenticado
  const { user, loginUser } = useAuth();

  const esMiPerfil = user?.id === personaId;

  const {
    persona,
    loading: cargando,
    error: errorCarga,
  } = usePersonal(Number.isFinite(personaId) ? personaId : null);

  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = usePersonalABM();

  const [exito, setExito] = useState(false);

  // =====================================================
  // VENCIMIENTOS DEL PERSONAL
  // =====================================================
  const { vencimientos, guardarVencimientos, error: errorVencimientos } =
    useVencimientosPersonal(
      Number.isFinite(personaId) ? personaId : null
    );

  const [valoresVencimientos, setValoresVencimientos] =
    useState<VencimientosPorAptitud>({});

  useEffect(() => {
    const mapa: VencimientosPorAptitud = {};

    vencimientos.forEach((v) => {
      mapa[v.aptitud_id] = v.fecha_vencimiento;
    });

    const timeoutId = window.setTimeout(() => setValoresVencimientos(mapa), 0);
    return () => window.clearTimeout(timeoutId);
  }, [vencimientos]);

  // =====================================================
  // PERMISOS
  // =====================================================
  const objetivo = persona ?? null;

  const puedeEditarCapacidades = objetivo
    ? puedeModificarRoles(user, objetivo)
    : false;

  const puedeAsignarSuperAdmin = esSuperAdmin(user);

  // =====================================================
  // GUARDAR CAMBIOS
  // =====================================================
  const handleSubmit = async (values: PersonaInput) => {
    try {
      // 1. Guardamos los datos personales
      const usuarioActualizado = await modificar(personaId, values);

      // 2. Guardamos los vencimientos asociados al personal
      await guardarVencimientos(personaId, valoresVencimientos);

      // 3. Si estamos editando nuestro propio perfil,
      // actualizamos la sesión inmediatamente
      if (esMiPerfil) {
        loginUser({
          id: usuarioActualizado.id,
          nombre: usuarioActualizado.nombre,
          apellido: usuarioActualizado.apellido || "",
          dni: usuarioActualizado.dni,
          puede_operar: usuarioActualizado.puede_operar,
          puede_administrar: usuarioActualizado.puede_administrar,
          es_super_admin: Boolean(usuarioActualizado.es_super_admin),
        });
      }

      // 4. Mostramos mensaje de éxito
      setExito(true);

      // 5. Volvemos al listado después del delay configurado
      delayedNavigate("/personal");
    } catch {
      // El error ya es manejado por el hook usePersonalABM
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Editar Personal
        </Heading>

        <BotonVolver onClick={() => navigate("/personal")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {cargando && (
        <Stack direction="row" gap="3" align="center" color="gray.600">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del personal...</Text>
        </Stack>
      )}

      {!cargando && errorCarga && (
        <BannerError>{errorCarga}</BannerError>
      )}

      {!cargando && !errorCarga && persona && (
        <>
          {errorGuardado && (
            <BannerError>{errorGuardado}</BannerError>
          )}
          {errorVencimientos && (
            <BannerError>{errorVencimientos}</BannerError>
          )}

          <PersonalForm
            key={persona.id}
            initialValues={{
              nombre: persona.nombre,
              apellido: persona.apellido || "",
              dni: persona.dni,
              email: persona.email,
              telefono: persona.telefono || "",
              puede_operar: persona.puede_operar,
              puede_administrar: persona.puede_administrar,
              es_super_admin: Boolean(persona.es_super_admin),
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Personal"
            puedeEditarCapacidades={puedeEditarCapacidades}
            puedeAsignarSuperAdmin={puedeAsignarSuperAdmin}
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/personal")}
            esMiPerfil={esMiPerfil}
          />

          <VencimientosPersonalForm
            valores={valoresVencimientos}
            onChange={setValoresVencimientos}
          />
        </>
      )}

      <DialogoExito
        isOpen={exito}
        mensaje="Personal modificado correctamente."
      />
    </Box>
  );
}
