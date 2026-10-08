import { useState } from "react";
import { Box, Field, Input } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
} from "../../../components/ui/patrones";
import type { UnidadMedidaFormValues } from "../types/unidadMedida";

interface UnidadMedidaFormProps {
  initialValues?: UnidadMedidaFormValues;
  onSubmit: (values: UnidadMedidaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: UnidadMedidaFormValues = {
  nombre: "",
  simbolo: "",
};

export function UnidadMedidaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Unidad de Medida",
  onCancel,
}: UnidadMedidaFormProps) {
  const [values, setValues] = useState<UnidadMedidaFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      nombre: e.target.value,
    }));

  const handleSimboloChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      simbolo: e.target.value.toUpperCase(),
    }));

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

      <Field.Root required mb="5">
        <Field.Label color="gray.600">NOMBRE *</Field.Label>
        <Input
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Litros, Kilogramos, Gramos"
          maxW="500px"
        />
      </Field.Root>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">SÍMBOLO *</Field.Label>
        <Input
          value={values.simbolo}
          onChange={handleSimboloChange}
          placeholder="Ej: L, KG, G"
          maxW="500px"
        />
      </Field.Root>

      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}