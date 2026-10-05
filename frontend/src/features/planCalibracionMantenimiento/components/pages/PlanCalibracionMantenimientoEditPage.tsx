import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, Button, Heading, HStack, Text } from "@chakra-ui/react";

import { usePlanCalibracionMantenimiento } from "../../hooks/usePlanCalibracionMantenimiento";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoForm } from "../PlanCalibracionMantenimientoForm";
import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoFormValues,
  PlanCalibracionMantenimientoUpdate,
} from "../../types/planCalibracionMantenimiento";

function formatearFecha(fecha: string) {
  return new Date(`${fecha.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR");
}

export function PlanCalibracionMantenimientoEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const {
    plan,
    loading: cargando,
    error: errorCarga,
  } = usePlanCalibracionMantenimiento(Number.isFinite(planId) ? planId : null);
  const {
    modificar,
    loading: guardando,
    error: errorGuardado,
  } = usePlanCalibracionMantenimientoABM();
  const [planActualizado, setPlanActualizado] =
    useState<PlanCalibracionMantenimiento | null>(null);

  const handleSubmit = async (values: PlanCalibracionMantenimientoFormValues) => {
    if (!plan) {
      return;
    }

    const cambios: PlanCalibracionMantenimientoUpdate = {};
    if (values.equipo_id !== plan.equipo_id) {
      cambios.equipo_id = values.equipo_id;
    }
    if (values.tipo !== plan.tipo) {
      cambios.tipo = values.tipo;
    }
    if (values.fecha_ultima_intervencion !== plan.fecha_ultima_intervencion.slice(0, 10)) {
      cambios.fecha_ultima_intervencion = values.fecha_ultima_intervencion;
    }
    if (values.periodicidad_dias !== plan.periodicidad_dias) {
      cambios.periodicidad_dias = values.periodicidad_dias;
    }

    try {
      const actualizado = await modificar(plan.id, cambios);
      setPlanActualizado(actualizado);
      setTimeout(() => {
        navigate("/planes-calibracion-mantenimiento");
      }, 2500);
    } catch {
      // El error queda expuesto por usePlanCalibracionMantenimientoABM().error.
    }
  };

  return (
    <Box style={{ padding: "20px", maxWidth: "700px", margin: "0 auto" }}>
      <HStack justify="space-between" mb="20px">
        <Heading as="h2" size="md" fontWeight="bold" color="black">
          Editar plan de calibración/mantenimiento
        </Heading>
        <Button
          bg="#6c757d"
          color="white"
          fontSize="16px"
          fontWeight="normal"
          height="auto"
          minW="auto"
          style={{ border: "none", padding: "8px 16px", borderRadius: "6px" }}
          _hover={{ bg: "#6c757d" }}
          onClick={() => navigate("/planes-calibracion-mantenimiento")}
        >
          Volver a la lista
        </Button>
      </HStack>

      {!cargando && errorCarga && <Text color="red.500">{errorCarga}</Text>}
      {cargando && (
        <Text style={{ fontStyle: "italic", color: "#666" }}>
          Cargando datos del plan...
        </Text>
      )}

      {!cargando && !errorCarga && plan && (
        <>
          {errorGuardado && (
            <Box
              style={{
                backgroundColor: "#f8d7da",
                color: "#721c24",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #f5c6cb",
                fontWeight: "bold",
              }}
            >
              {errorGuardado}
            </Box>
          )}

          {planActualizado && (
            <Box
              style={{
                backgroundColor: "#d4edda",
                color: "#155724",
                padding: "16px",
                borderRadius: "6px",
                marginBottom: "20px",
                border: "1px solid #c3e6cb",
              }}
            >
              <Text fontWeight="bold">Plan actualizado correctamente.</Text>
              <Text>
                Próximo vencimiento: {formatearFecha(planActualizado.proxima_fecha_vencimiento)}.
              </Text>
              <Text>Días restantes: {planActualizado.dias_restantes}.</Text>
            </Box>
          )}

          <PlanCalibracionMantenimientoForm
            key={plan.id}
            initialValues={{
              equipo_id: plan.equipo_id,
              tipo: plan.tipo,
              fecha_ultima_intervencion: plan.fecha_ultima_intervencion.slice(0, 10),
              periodicidad_dias: plan.periodicidad_dias,
            }}
            onSubmit={handleSubmit}
            isLoading={guardando}
            title="Modificar Plan de Calibración/Mantenimiento"
            submitLabel="Guardar cambios"
            onCancel={() => navigate("/planes-calibracion-mantenimiento")}
          />
        </>
      )}
    </Box>
  );
}
