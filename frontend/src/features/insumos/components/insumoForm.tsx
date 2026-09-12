import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
} from "@chakra-ui/react";
import { TIPOS_UNIDAD, type Insumo } from "../types/insumo";

type InsumoFormValues = Omit<Insumo, "id">;

interface InsumoFormProps {
  initialValues?: InsumoFormValues;
  onSubmit: (values: InsumoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: InsumoFormValues = { nombre: "", tipo: "kg" };

const estiloInput = {
  backgroundColor: "#fff",
  padding: "12px",
  width: "100%",
  maxWidth: "500px",
  borderRadius: "8px",
  border: "2px solid #90BEBB",
  fontSize: "16px",
  outline: "none",
  color: "#333",
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

const estiloLabel = {
  display: "block",
  fontSize: "14px",
  fontWeight: "bold" as const,
  marginBottom: "8px",
  color: "#555",
};

export function InsumoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Insumo",
  onCancel,
}: InsumoFormProps) {
  const [values, setValues] = useState<InsumoFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as InsumoFormValues["tipo"],
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <Box
      as="form"
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "#ffffff",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        marginBottom: "30px",
      }}
    >
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: "#468189" }}>
        {title}
      </Box>

      {/* Nombre */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>
          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Fertilizante nitrogenado"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* Tipo de unidad */}
      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE UNIDAD *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              {TIPOS_UNIDAD.map((tipo) => (
                <option
                  key={tipo.value}
                  value={tipo.value}
                  style={{ backgroundColor: "#fff", color: "#333" }}
                >
                  {tipo.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      {/* Botones */}
      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          style={{
            backgroundColor: "#468189",
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          {submitLabel}
        </Button>

        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            style={{
              backgroundColor: "#e0e0e0",
              color: "#333",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "bold",
            }}
          >
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}
