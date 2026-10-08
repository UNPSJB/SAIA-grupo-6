import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Heading, HStack, Stack, Spinner, Text } from "@chakra-ui/react";
import { PlanLimpiezaForm } from "../PlanLimpiezaForm";
import { usePlanLimpieza } from "../../hooks/usePlanLimpieza";
import { usePlanLimpiezaABM } from "../../hooks/usePlanLimpiezaABM";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import type { PlanLimpiezaInput } from "../../services/planLimpiezaService";
import {
  BannerError,
  BannerExito,
  BotonVolver,
} from "../../../../components/ui/patrones";

export function PlanLimpiezaEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);

  const {
    plan,
    loading: cargando,
    error: errorCarga,
  } = usePlanLimpieza(Number.isFinite(planId) ? planId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = usePlanLimpiezaABM();
  // Un solo aviso de éxito, no dos: el `DialogoExito` es modal y sin salida,
// así que el `BannerExito` de abajo quedaba oculto detrás de él durante los
// 4 segundos de la redirección y el usuario nunca leía la advertencia
// importante sobre el checklist del día.
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const handleSubmit = async (values: PlanLimpiezaInput) => {
    try {
      await modificar(planId, values);
      setMostrarAviso(true);
      delayedNavigate("/planes-limpieza", 4000);
    } catch {
      // The mutation hook exposes the failure state to this page.
    }
  };

  return (
    <Box p="5" maxW="600px" mx="auto">
      <HStack justify="space-between" mb="5">
        <Heading as="h2" size="md" fontWeight="bold" color="gray.900">
          Editar Plan de Limpieza
        </Heading>
        <BotonVolver onClick={() => navigate("/planes-limpieza")}>
          Volver a la lista
        </BotonVolver>
      </HStack>

      {mostrarAviso && (
        <BannerExito>
          Plan actualizado. Tené en cuenta que el checklist de hoy es una foto
          del plan al momento de generarse: los cambios se aplican a los
          checklists que se generen desde mañana, así los operarios no vean
          cambiar sus tareas mientras las siguen.
        </BannerExito>
      )}

      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && (
        <Stack direction="row" gap="3" align="center" color="gray.600">
          <Spinner size="sm" color="brand.500" />
          <Text fontStyle="italic">Cargando datos del plan...</Text>
        </Stack>
      )}

      {!cargando && !errorCarga && plan && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          <PlanLimpiezaForm
            key={plan.id}
            initialValues={{
              nombre: plan.nombre,
              tareas: plan.tareas
                .filter((tarea) => tarea.activo)
                .map((tarea) => ({
                  id: tarea.id,
                  nombre: tarea.nombre,
                  frecuencia: tarea.frecuencia,
                  descripcion: tarea.descripcion ?? "",
                })),
              equipo_id: plan.equipo_id,
              autor_id: plan.autor_id,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Plan de Limpieza"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/planes-limpieza")}
          />
        </>
      )}
    </Box>
  );
}