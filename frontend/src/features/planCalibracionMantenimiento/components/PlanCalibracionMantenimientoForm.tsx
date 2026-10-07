import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
  Text,
} from "@chakra-ui/react";

import { useEquipos } from "../../equipo/hooks/useEquipos";
import type {
  PlanCalibracionMantenimientoFormValues,
  TipoPlanCalibracionMantenimiento,
} from "../types/planCalibracionMantenimiento";
import {
  BLANCO,
  ERROR_FONDO,
  ERROR_TEXTO,
  GRIS_CLARO,
  TEAL,
  TEXTO_PRIMARIO,
  TEXTO_TENUE,
  estiloInput,
  estiloLabel,
} from "../../../common/theme/tokens";

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
  fecha_ultima_intervencion: new Date().toISOString().split("T")[0],
  periodicidad_dias: 30,
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
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
    <Box
      as="form"
      onSubmit={handleSubmit}
      style={{
        backgroundColor: BLANCO,
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        marginBottom: "30px",
      }}
    >
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: TEAL }}>
        {title}
      </Box>

      {errorEquipos && (
        <Box
          style={{
            backgroundColor: ERROR_FONDO,
            color: ERROR_TEXTO,
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
          }}
        >
          {errorEquipos}
        </Box>
      )}

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            EQUIPO *
          </Box>
          <NativeSelect.Root disabled={cargandoEquipos}>
            <NativeSelect.Field
              value={values.equipo_id}
              onChange={handleEquipoChange}
              style={estiloSelect}
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
        </Field.Root>
        <Text style={{ fontSize: "12px", color: TEXTO_TENUE, marginTop: "6px" }}>
          Sólo se muestran equipos activos.
        </Text>
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE PLAN *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              <option value="calibracion">Calibración</option>
              <option value="mantenimiento">Mantenimiento</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            FECHA DE LA ÚLTIMA INTERVENCIÓN *
          </Box>
          <Input
            type="date"
            value={values.fecha_ultima_intervencion}
            onChange={handleFechaChange}
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            PERIODICIDAD (DÍAS) *
          </Box>
          <Input
            type="number"
            min={1}
            value={values.periodicidad_dias}
            onChange={handlePeriodicidadChange}
            placeholder="Ej: 30"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          disabled={cargandoEquipos || formularioInvalido}
          style={{
            backgroundColor: TEAL,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          {submitLabel}
        </Button>

        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            style={{
              backgroundColor: GRIS_CLARO,
              color: TEXTO_PRIMARIO,
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "bold",
            }}
          >
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}
