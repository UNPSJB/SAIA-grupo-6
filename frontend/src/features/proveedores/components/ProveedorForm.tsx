import { useState } from "react";
import { Box } from "@chakra-ui/react";
import type { ProveedorFormValues } from "../types/proveedor";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  faltantes,
  FormField,
  FormInput,
  SIN_VALIDACION_NATIVA,
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
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
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    matricula: [!values.matricula.trim(), "la matrícula"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required mb="4">
          <FormInput
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Laboratorio Central S.A."
            maxW="500px"
          />
        </FormField>

        <FormField invalid={intentado && faltan.tiene("matricula")} label="Matrícula" required mb="0">
          <FormInput
            value={values.matricula}
            onChange={(e) => setValues((prev) => ({ ...prev, matricula: e.target.value }))}
            placeholder="Ej: MAT-12345"
            maxW="500px"
          />
        </FormField>

        <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
        <AccionesFormulario>
          <BotonGuardar
            loading={isLoading}
          >
            {submitLabel}
          </BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
