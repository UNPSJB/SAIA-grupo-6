import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";

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
import {
  ERROR_FONDO,
  ERROR_TEXTO,
  EXITO,
  GRIS_MEDIO,
  TEXTO_SECUNDARIO,
  TEXTO_TERCIARIO,
} from "../../../../common/theme/tokens";

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
    <Box
      style={{
        padding: "20px",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <HStack justify="space-between" mb="20px">
        <Heading
          as="h2"
          size="md"
          fontWeight="bold"
          color="black"
        >
          Editar Personal
        </Heading>

        <Button
          bg={GRIS_MEDIO}
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
          }}
          _hover={{ bg: GRIS_MEDIO }}
          onClick={() => navigate("/personal")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && (
        <Text color="red.500">{errorCarga}</Text>
      )}

      {cargando && (
        <Text
          style={{
            fontStyle: "italic",
            color: TEXTO_TERCIARIO,
          }}
        >
          Cargando datos del personal...
        </Text>
      )}

      {!cargando && !errorCarga && persona && (
        <>
          {errorGuardado && (
            <Box
              style={{
                backgroundColor: ERROR_FONDO,
                color: ERROR_TEXTO,
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #f5c6cb",
                fontWeight: "bold",
              }}
            >
              ⚠️ {errorGuardado}
            </Box>
          )}
          {errorVencimientos && (
            <Box
              style={{
                backgroundColor: ERROR_FONDO,
                color: ERROR_TEXTO,
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #f5c6cb",
                fontWeight: "bold",
              }}
            >
              {errorVencimientos}
            </Box>
          )}

          {exito && (
            <Box
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
            >
              <Box
                style={{
                  backgroundColor: "white",
                  padding: "30px 50px",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                  textAlign: "center",
                }}
              >
                <Box
                  style={{
                    fontSize: "50px",
                    marginBottom: "10px",
                  }}
                >
                  ✅
                </Box>

                <Heading
                  as="h3"
                  style={{
                    margin: 0,
                    color: EXITO,
                    fontSize: "24px",
                  }}
                >
                  Éxito
                </Heading>

                <Text
                  style={{
                    color: TEXTO_SECUNDARIO,
                    marginTop: "10px",
                    fontSize: "16px",
                    fontWeight: 500,
                  }}
                >
                  Personal modificado correctamente.
                </Text>
              </Box>
            </Box>
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
    </Box>
  );
}
