import { useState } from "react";
import {
  FormField,
  FormInput,
  FormNativeSelect,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  SeccionFormulario,
} from "../../../components/ui/formularios";
import type {
  TipoUnidadMedida,
  UnidadMedidaFormValues,
  UnidadMedidaInput,
} from "../types/unidadMedida";

interface UnidadMedidaFormProps {
  initialValues?: UnidadMedidaFormValues;
  onSubmit: (values: UnidadMedidaInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const TIPO_UNIDAD_OPCIONES: { valor: TipoUnidadMedida; etiqueta: string }[] = [
  { valor: "masa", etiqueta: "Masa" },
  { valor: "volumen", etiqueta: "Volumen" },
  { valor: "unidad", etiqueta: "Unidad" },
];

const emptyValues: UnidadMedidaFormValues = {
  nombre: "",
  simbolo: "",
  tipo: "unidad",
  factor_a_base: "",
};

export function UnidadMedidaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
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

  const handleFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const texto = e.target.value.replace(/,/g, ".");
    // Permitir solo dígitos, un punto decimal y vacío (para borrar)
    if (texto === "" || /^\d*\.?\d*$/.test(texto)) {
      setValues((prev) => ({
        ...prev,
        factor_a_base: texto,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Si está vacío, enviar 1 (el default del backend). Si tiene coma, convertir a punto.
    const valorFactor =
      values.factor_a_base === "" ? 1 : Number(values.factor_a_base);
    onSubmit({
      ...values,
      factor_a_base: valorFactor,
    });
  };

  return (
    <FormularioAlta onSubmit={handleSubmit}>
      <SeccionFormulario>
        <GrillaFormulario>
          <FormField label="Nombre" required completo="doble">
            <FormInput
              value={values.nombre}
              onChange={handleNombreChange}
              placeholder="Ej: Litros, Kilogramos, Gramos"
            />
          </FormField>

          <FormField label="Símbolo" required>
            <FormInput
              value={values.simbolo}
              onChange={handleSimboloChange}
              placeholder="Ej: L, KG, G"
            />
          </FormField>

          <FormField label="Tipo">
            <FormNativeSelect value={values.tipo} onChange={handleTipoChange}>
              {TIPO_UNIDAD_OPCIONES.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>

          <FormField label="Factor a base" required>
            <FormInput
              type="text"
              inputMode="decimal"
              value={values.factor_a_base}
              onChange={handleFactorChange}
              placeholder="Ej: 1.0000"
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <AccionesAlta etiqueta={submitLabel} guardando={isLoading} onCancelar={onCancel} />
    </FormularioAlta>
  );
}
