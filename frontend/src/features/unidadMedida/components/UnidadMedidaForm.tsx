import { useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import type { UnidadMedidaFormValues, TipoUnidadMedida } from "../types/unidadMedida";

const TIPO_UNIDAD_OPCIONES: { valor: TipoUnidadMedida; etiqueta: string }[] = [
  { valor: "masa", etiqueta: "Masa" },
  { valor: "volumen", etiqueta: "Volumen" },
  { valor: "unidad", etiqueta: "Unidad" },
];

const emptyValues: UnidadMedidaFormValues = {
  nombre: "",
  simbolo: "",
  tipo: "unidad",
  factor_a_base: 1,
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

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as TipoUnidadMedida,
    }));

  const handleFactorChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      factor_a_base: Number(e.target.value) || 0,
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

        <FormField label="Tipo">
          <FormNativeSelect
            value={values.tipo}
            onChange={handleTipoChange}
            maxW="500px"
          >
            {TIPO_UNIDAD_OPCIONES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </FormNativeSelect>
        </FormField>

        <FormField label="Factor a base" required mb="0">
          <FormInput
            type="number"
            step="0.0001"
            min="0.0001"
            value={values.factor_a_base}
            onChange={handleFactorChange}
            placeholder="Ej: 1.0000"
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
