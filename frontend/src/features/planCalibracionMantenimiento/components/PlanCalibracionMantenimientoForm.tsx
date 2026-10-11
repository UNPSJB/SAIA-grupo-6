import { useState } from "react";

import { useEquipos } from "../../equipo/hooks/useEquipos";
import { hoyISO } from "../../../common/utils/fechas";
import type {
  PlanCalibracionMantenimientoFormValues,
  TipoPlanCalibracionMantenimiento,
} from "../types/planCalibracionMantenimiento";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";

interface PlanCalibracionMantenimientoFormProps {
  initialValues?: PlanCalibracionMantenimientoFormValues;
  onSubmit: (values: PlanCalibracionMantenimientoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: PlanCalibracionMantenimientoFormValues = {
  equipo_id: 0,
  tipo: "calibracion",
  // `hoyISO()` y no `toISOString()`: en UTC-3 el `toISOString()` devuelve el
  // día anterior entre las 21:00 y las 24:00.
  fecha_ultima_intervencion: hoyISO(),
  periodicidad_dias: 30,
};

export function PlanCalibracionMantenimientoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Plan de Calibración/Mantenimiento",
  onCancel,
}: PlanCalibracionMantenimientoFormProps) {
  const [values, setValues] = useState<PlanCalibracionMantenimientoFormValues>(
    initialValues,
  );
  const {
    equipos,
    loading: cargandoEquipos,
    error: errorEquipos,
  } = useEquipos();

  const handleEquipoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setValues((prev) => ({ ...prev, equipo_id: Number(event.target.value) }));
  };

  const handleTipoChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setValues((prev) => ({
      ...prev,
      tipo: event.target.value as TipoPlanCalibracionMantenimiento,
    }));
  };

  const handleFechaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({
      ...prev,
      fecha_ultima_intervencion: event.target.value,
    }));
  };

  const handlePeriodicidadChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setValues((prev) => ({
      ...prev,
      periodicidad_dias: Number(event.target.value),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  const formularioInvalido =
    !values.equipo_id ||
    !values.fecha_ultima_intervencion ||
    values.periodicidad_dias <= 0;

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit} mb="0">
      <TituloFormulario>{title}</TituloFormulario>

      {errorEquipos && <BannerError>{errorEquipos}</BannerError>}

      <FormField label="Equipo" required helper="Sólo se muestran equipos activos.">
        <FormNativeSelect
          value={values.equipo_id}
          onChange={handleEquipoChange}
          disabled={cargandoEquipos}
          maxW="500px"
        >
          <SelectPlaceholder>
            {cargandoEquipos ? "Cargando equipos..." : "Seleccioná un equipo"}
          </SelectPlaceholder>
          {equipos.map((equipo) => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre} - {equipo.tipo} ({equipo.ubicacion})
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      <FormField label="Tipo de plan" required>
        <FormNativeSelect
          value={values.tipo}
          onChange={handleTipoChange}
          maxW="500px"
        >
          <option value="calibracion">Calibración</option>
          <option value="mantenimiento">Mantenimiento</option>
        </FormNativeSelect>
      </FormField>

      <FormField label="Fecha de la última intervención" required>
        <FormInput
          type="date"
          value={values.fecha_ultima_intervencion}
          onChange={handleFechaChange}
          maxW="500px"
        />
      </FormField>

      <FormField label="Periodicidad (días)" required mb="0">
        <FormInput
          type="number"
          min={1}
          value={values.periodicidad_dias}
          onChange={handlePeriodicidadChange}
          placeholder="Ej: 30"
          maxW="500px"
        />
      </FormField>

      <AccionesFormulario>
        <BotonGuardar
          loading={isLoading}
          disabled={cargandoEquipos || formularioInvalido}
        >
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}