import { useState } from "react";
import { Box, Textarea } from "@chakra-ui/react";
import type { AptitudFormValues } from "../types/aptitud";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";

interface AptitudFormProps {
  initialValues?: AptitudFormValues;
  onSubmit: (values: AptitudFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: AptitudFormValues = { nombre: "", descripcion: "" };

/**
 * El aspecto de los controles lo dan `FormInput` y la receta del tema; acá no
 * hay objetos de estilo. El ancho (`maxW="500px"`) es una decisión de layout.
 */
export function AptitudForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Aptitud",
  onCancel,
}: AptitudFormProps) {
  const [values, setValues] = useState<AptitudFormValues>(initialValues);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField label="Nombre" required mb="4">
          <FormInput
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Carnet de Manipulador"
            maxW="500px"
          />
        </FormField>

        <FormField
          label="Descripción"
          helper="Opcional: qué certifica esta aptitud."
          mb="0"
        >
          <Textarea
            value={values.descripcion || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Opcional: qué certifica esta aptitud"
            minH="80px"
            maxW="500px"
          />
        </FormField>

        <AccionesFormulario>
          <BotonGuardar loading={isLoading} disabled={!values.nombre.trim()}>
            {submitLabel}
          </BotonGuardar>
          {onCancel && (
            <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>
          )}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
