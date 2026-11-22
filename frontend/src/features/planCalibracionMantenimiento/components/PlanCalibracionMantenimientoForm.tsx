import { useState } from "react";

import { useEquipos } from "../../equipo/hooks/useEquipos";
import { hoyISO } from "../../../common/utils/fechas";
import type {
  PlanCalibracionMantenimientoFormValues,
  TipoPlanCalibracionMantenimiento,
} from "../types/planCalibracionMantenimiento";
import {
  BannerError,
  faltantes,
  FormField,
  FormNativeSelect,
  SelectPlaceholder,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  InputFecha,
  InputUnidad,
  SeccionFormulario,
} from "../../../components/ui/formularios";

interface PlanCalibracionMantenimientoFormProps {
  initialValues?: PlanCalibracionMantenimientoFormValues;
  onSubmit: (values: PlanCalibracionMantenimientoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
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

  const faltan = faltantes({
    equipo: [!values.equipo_id, "el equipo"],
    fecha: [!values.fecha_ultima_intervencion, "la fecha de la última intervención"],
    periodicidad: [!(values.periodicidad_dias > 0), "la periodicidad (mayor a cero)"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };

  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa mb="0">
      <SeccionFormulario>
        <GrillaFormulario>
          {errorEquipos && (
            <CeldaCompleta>
              <BannerError mb="0">{errorEquipos}</BannerError>
            </CeldaCompleta>
          )}

          <FormField label="Equipo" required completo helper="Sólo se muestran equipos activos." invalid={intentado && faltan.tiene("equipo")}>
            <FormNativeSelect
              value={values.equipo_id}
              onChange={handleEquipoChange}
              disabled={cargandoEquipos}
            >
              <SelectPlaceholder>
                {cargandoEquipos ? "Cargando equipos..." : "Seleccioná un equipo"}
              </SelectPlaceholder>
              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre} - {equipo.tipo} ({equipo.sector.nombre})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Tipo de plan" required completo>
            <FormNativeSelect value={values.tipo} onChange={handleTipoChange}>
              <option value="calibracion">Calibración</option>
              <option value="mantenimiento">Mantenimiento</option>
            </FormNativeSelect>
          </FormField>

          <FormField label="Fecha de la última intervención" required invalid={intentado && faltan.tiene("fecha")}>
            <InputFecha
              value={values.fecha_ultima_intervencion}
              onChange={handleFechaChange}
            />
          </FormField>

          <FormField label="Periodicidad" required invalid={intentado && faltan.tiene("periodicidad")}>
            <InputUnidad
              unidad="días"
              type="number"
              min={1}
              value={values.periodicidad_dias}
              onChange={handlePeriodicidadChange}
              placeholder="Ej: 30"
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <AccionesAlta
        etiqueta={submitLabel}
        deshabilitado={cargandoEquipos}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltan.lista}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}