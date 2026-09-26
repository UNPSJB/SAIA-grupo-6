import { useState } from "react";
import { Box, Button, Field, HStack, Input, NativeSelect } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  UNIDADES_MEDIDA,
  type InsumoQuimico,
  type TipoQuimico,
  type UnidadMedidaQuimico,
} from "../types/insumoQuimico";

type InsumoQuimicoFormValues = Omit<InsumoQuimico, "id" | "activo">;

interface InsumoQuimicoFormProps {
  initialValues?: InsumoQuimicoFormValues;
  onSubmit: (values: InsumoQuimicoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: InsumoQuimicoFormValues = {
  nombre: "",
  tipo: "detergente",
  unidad_medida: "l",
};

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

export function InsumoQuimicoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Insumo Químico",
  onCancel,
}: InsumoQuimicoFormProps) {
  const [values, setValues] = useState<InsumoQuimicoFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      nombre: e.target.value,
    }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as TipoQuimico,
    }));

  const handleUnidadChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      unidad_medida: e.target.value as UnidadMedidaQuimico,
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
      <Box
        as="h3"
        style={{
          marginTop: 0,
          fontSize: "22px",
          color: "#468189",
        }}
      >
        {title}
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>
          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Detergente Industrial Concentrado"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE PRODUCTO QUÍMICO *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              {TIPOS_QUIMICOS.map((tipo) => (
                <option
                  key={tipo.value}
                  value={tipo.value}
                  style={{
                    backgroundColor: "#fff",
                    color: "#333",
                  }}
                >
                  {tipo.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            UNIDAD DE MEDIDA HABITUAL *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.unidad_medida}
              onChange={handleUnidadChange}
              style={estiloSelect}
            >
              {UNIDADES_MEDIDA.map((unidad) => (
                <option
                  key={unidad.value}
                  value={unidad.value}
                  style={{
                    backgroundColor: "#fff",
                    color: "#333",
                  }}
                >
                  {unidad.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

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