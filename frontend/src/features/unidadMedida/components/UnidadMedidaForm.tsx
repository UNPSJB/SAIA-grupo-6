import { useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
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
  title = "Alta de unidad de medida",
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
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField label="Nombre" required>
          <FormInput
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Litros, Kilogramos, Gramos"
            maxW="500px"
          />
        </FormField>

        <FormField label="Símbolo" required mb="0">
          <FormInput
            value={values.simbolo}
            onChange={handleSimboloChange}
            placeholder="Ej: L, KG, G"
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
