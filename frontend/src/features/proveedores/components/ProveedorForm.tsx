import { useState } from "react";
import { Box } from "@chakra-ui/react";
import type { ProveedorFormValues } from "../types/proveedor";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";

interface ProveedorFormProps {
  initialValues?: ProveedorFormValues;
  onSubmit: (values: ProveedorFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: ProveedorFormValues = { nombre: "", matricula: "" };

export function ProveedorForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de proveedor",
  onCancel,
}: ProveedorFormProps) {
  const [values, setValues] = useState<ProveedorFormValues>(initialValues);

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
            placeholder="Ej: Laboratorio Central S.A."
            maxW="500px"
          />
        </FormField>

        <FormField label="Matrícula" required mb="0">
          <FormInput
            value={values.matricula}
            onChange={(e) => setValues((prev) => ({ ...prev, matricula: e.target.value }))}
            placeholder="Ej: MAT-12345"
            maxW="500px"
          />
        </FormField>

        <AccionesFormulario>
          <BotonGuardar
            loading={isLoading}
            disabled={!values.nombre.trim() || !values.matricula.trim()}
          >
            {submitLabel}
          </BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
