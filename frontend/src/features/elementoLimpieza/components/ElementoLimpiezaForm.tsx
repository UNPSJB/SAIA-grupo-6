import { useState } from "react";
import { Box, Field, Input } from "@chakra-ui/react";
import type { ElementoLimpiezaFormValues } from "../types/elementoLimpieza";
import { hoyISO } from "../../../common/utils/fechas";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
} from "../../../components/ui/patrones";

interface ElementoLimpiezaFormProps {
  initialValues?: ElementoLimpiezaFormValues;
  onSubmit: (values: ElementoLimpiezaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: ElementoLimpiezaFormValues = {
  nombre: "",
  // `hoyISO()` y no `toISOString()`: este convierte a UTC, así que entre las
  // 21:00 y las 24:00 en Argentina (UTC-3) el campo abría con el día
  // anterior. `common/utils/fechas.ts` ya lo resuelve.
  fecha_ultimo_recambio: hoyISO(),
  frecuencia_recambio_dias: 30, // Frecuencia por defecto
};

/**
 * El aspecto del input lo aporta la receta `input` del tema
 * (`src/theme/index.ts`), así que acá no hay ningún objeto de estilo. El
 * ancho (`maxW="500px"`) sí es una decisión de layout y queda como prop.
 */
export function ElementoLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Elemento de Limpieza",
  onCancel,
}: ElementoLimpiezaFormProps) {
  const [values, setValues] = useState<ElementoLimpiezaFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleFechaChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, fecha_ultimo_recambio: e.target.value }));

  const handleFrecuenciaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValues((prev) => ({
      ...prev,
      frecuencia_recambio_dias: val === "" ? null : Number(val),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

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
      <Box
        as="h3"
        mt={0}
        fontSize="2xl"
        fontWeight="bold"
        color="brand.500"
        mb="6"
      >
        {title}
      </Box>

      {/* 1. Nombre */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">NOMBRE *</Field.Label>
        <Input
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Detergente Multiuso"
          maxW="500px"
        />
      </Field.Root>

      {/* 2. Fecha Último Recambio */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">FECHA ÚLTIMO RECAMBIO *</Field.Label>
        <Input
          type="date"
          value={values.fecha_ultimo_recambio ?? ""}
          onChange={handleFechaChange}
          maxW="500px"
        />
      </Field.Root>

      {/* 3. Frecuencia de Recambio (Días) */}
      <Field.Root mb="5">
        <Field.Label color="gray.600">FRECUENCIA RECAMBIO (DÍAS)</Field.Label>
        <Input
          type="number"
          min={1}
          value={values.frecuencia_recambio_dias ?? ""}
          onChange={handleFrecuenciaChange}
          placeholder="Ej: 30"
          maxW="500px"
        />
      </Field.Root>

      {/* Botones */}
      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}
