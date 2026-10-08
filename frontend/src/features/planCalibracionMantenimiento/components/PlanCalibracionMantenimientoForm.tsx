import { useState } from "react";
import { Box, Field, Heading, Input, NativeSelect, Text } from "@chakra-ui/react";

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

/**
 * `NativeSelect.Field` no consume la receta `input` del tema, así que el
 * borde y el fondo hay que pasarlos a mano.
 */
const propsSelect = {
  bg: "white",
  borderWidth: "2px",
  borderColor: "brand.300",
  rounded: "lg",
  maxW: "500px",
} as const;

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
    <Box
      as="form"
      onSubmit={handleSubmit}
      bg="white"
      p="8"
      rounded="xl"
      boxShadow="card"
      mb="8"
    >
      <Heading as="h3" mt={0} size="lg" color="brand.500" fontWeight="bold" mb="6">
        {title}
      </Heading>

      {errorEquipos && <BannerError>{errorEquipos}</BannerError>}

      <Field.Root required mb="5">
        <Field.Label color="gray.600">EQUIPO *</Field.Label>
        <NativeSelect.Root disabled={cargandoEquipos}>
          <NativeSelect.Field
            value={values.equipo_id}
            onChange={handleEquipoChange}
            {...propsSelect}
          >
            <option value={0} disabled>
              {cargandoEquipos ? "Cargando equipos..." : "Seleccioná un equipo"}
            </option>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre} - {equipo.tipo} ({equipo.ubicacion})
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text fontSize="xs" color="gray.400" mt={0}>
          Sólo se muestran equipos activos.
        </Text>
      </Field.Root>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">TIPO DE PLAN *</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={values.tipo}
            onChange={handleTipoChange}
            {...propsSelect}
          >
            <option value="calibracion">Calibración</option>
            <option value="mantenimiento">Mantenimiento</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">FECHA DE LA ÚLTIMA INTERVENCIÓN *</Field.Label>
        <Input
          type="date"
          value={values.fecha_ultima_intervencion}
          onChange={handleFechaChange}
          maxW="500px"
        />
      </Field.Root>

      <Field.Root required mb="6">
        <Field.Label color="gray.600">PERIODICIDAD (DÍAS) *</Field.Label>
        <Input
          type="number"
          min={1}
          value={values.periodicidad_dias}
          onChange={handlePeriodicidadChange}
          placeholder="Ej: 30"
          maxW="500px"
        />
      </Field.Root>

      <AccionesFormulario>
        <BotonGuardar
          loading={isLoading}
          disabled={cargandoEquipos || formularioInvalido}
        >
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}