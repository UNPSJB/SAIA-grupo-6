import { useState } from "react";
import type { ElementoLimpiezaFormValues } from "../types/elementoLimpieza";
import { hoyISO } from "../../../common/utils/fechas";
import {
  FormField,
  FormInput,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  InputFecha,
  InputUnidad,
  SeccionFormulario,
} from "../../../components/ui/formularios";

interface ElementoLimpiezaFormProps {
  initialValues?: ElementoLimpiezaFormValues;
  onSubmit: (values: ElementoLimpiezaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
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
 * El layout lo dan las piezas de `formularios.tsx`.
 */
export function ElementoLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
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
    <FormularioAlta onSubmit={handleSubmit}>
      <SeccionFormulario>
        <GrillaFormulario>
          <FormField label="Nombre" required completo>
            <FormInput
              value={values.nombre}
              onChange={handleNombreChange}
              placeholder="Ej: Detergente multiuso"
            />
          </FormField>

          <FormField label="Fecha del último recambio" required>
            <InputFecha
              value={values.fecha_ultimo_recambio ?? ""}
              onChange={handleFechaChange}
            />
          </FormField>

          <FormField
            label="Frecuencia de recambio"
            opcional
            helper="Dejalo vacío si no querés calcular el vencimiento."
          >
            <InputUnidad
              unidad="días"
              type="number"
              min={1}
              value={values.frecuencia_recambio_dias ?? ""}
              onChange={handleFrecuenciaChange}
              placeholder="Ej: 30"
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <AccionesAlta etiqueta={submitLabel} guardando={isLoading} onCancelar={onCancel} />
    </FormularioAlta>
  );
}
