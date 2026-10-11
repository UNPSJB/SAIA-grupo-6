import { useState } from "react";
import { Box } from "@chakra-ui/react";
import type { ElementoLimpiezaFormValues } from "../types/elementoLimpieza";
import { hoyISO } from "../../../common/utils/fechas";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
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
 * El aspecto de los controles lo da `FormInput`; acá no hay objetos de estilo.
 * El ancho (`maxW="500px"`) es una decisión de layout.
 */
export function ElementoLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de elemento de limpieza",
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
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField label="Nombre" required>
          <FormInput
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Detergente multiuso"
            maxW="500px"
          />
        </FormField>

        <FormField label="Fecha del último recambio" required>
          <FormInput
            type="date"
            value={values.fecha_ultimo_recambio ?? ""}
            onChange={handleFechaChange}
            maxW="500px"
          />
        </FormField>

        <FormField
          label="Frecuencia de recambio (días)"
          helper="Dejalo vacío si no querés calcular el vencimiento."
          mb="0"
        >
          <FormInput
            type="number"
            min={1}
            value={values.frecuencia_recambio_dias ?? ""}
            onChange={handleFrecuenciaChange}
            placeholder="Ej: 30"
            maxW="500px"
          />
        </FormField>

        <AccionesFormulario>
          <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
