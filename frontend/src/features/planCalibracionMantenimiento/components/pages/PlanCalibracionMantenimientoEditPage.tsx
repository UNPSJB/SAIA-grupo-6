import { formatoFecha } from "../../../../common/utils/fechas";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDelayedNavigate } from "../../../../common/hooks/useDelayedNavigate";
import { Text } from "@chakra-ui/react";

import { usePlanCalibracionMantenimiento } from "../../hooks/usePlanCalibracionMantenimiento";
import { usePlanCalibracionMantenimientoABM } from "../../hooks/usePlanCalibracionMantenimientoABM";
import { PlanCalibracionMantenimientoForm } from "../PlanCalibracionMantenimientoForm";
import type {
  PlanCalibracionMantenimiento,
  PlanCalibracionMantenimientoFormValues,
  PlanCalibracionMantenimientoUpdate,
} from "../../types/planCalibracionMantenimiento";
import {
  BannerError,
  BannerExito,
  EstadoCargando,
} from "../../../../components/ui/patrones";
import { PaginaFormulario } from "../../../../components/ui/plantillas";

export function PlanCalibracionMantenimientoEditPage() {
  const navigate = useNavigate();
  const delayedNavigate = useDelayedNavigate();
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
      delayedNavigate("/planes-calibracion-mantenimiento", 2500);
    } catch {
      // El error queda expuesto por usePlanCalibracionMantenimientoABM().error.
    }
  };

  return (
    <PaginaFormulario
      volver={{ a: "/planes-calibracion-mantenimiento", etiqueta: "Calibración y mantenimiento" }}
      titulo="Editar plan de calibración/mantenimiento"
      descripcion={
        plan
          ? `Plan #${plan.id} · ${
              plan.tipo === "calibracion" ? "Calibración" : "Mantenimiento"
            }`
          : undefined
      }
    >
      {!cargando && errorCarga && <BannerError>{errorCarga}</BannerError>}
      {cargando && <EstadoCargando>Cargando datos del plan...</EstadoCargando>}

      {!cargando && !errorCarga && plan && (
        <>
          {errorGuardado && <BannerError>{errorGuardado}</BannerError>}

          {planActualizado && (
            <BannerExito>
              <Text fontWeight="bold">Plan actualizado correctamente.</Text>
              <Text>
                Próximo vencimiento:{" "}
                {formatoFecha(planActualizado.proxima_fecha_vencimiento)}.
              </Text>
              <Text>Días restantes: {planActualizado.dias_restantes}.</Text>
            </BannerExito>
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
    </PaginaFormulario>
  );
}