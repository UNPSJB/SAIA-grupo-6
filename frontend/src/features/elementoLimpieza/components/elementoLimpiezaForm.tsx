import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
} from "@chakra-ui/react";
import type { ElementoLimpieza } from "../types/elementoLimpieza";

type ElementoLimpiezaFormValues = Omit<
  ElementoLimpieza,
  "id" | "activo" | "estado_alerta"
>;

interface ElementoLimpiezaFormProps {
  initialValues?: ElementoLimpiezaFormValues;
  onSubmit: (values: ElementoLimpiezaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: ElementoLimpiezaFormValues = {
  nombre: "",
  fecha_ultimo_recambio: new Date().toISOString().split("T")[0], // Fecha de hoy por defecto
  frecuencia_recambio_dias: 30, // Frecuencia por defecto
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

const estiloLabel = {
  display: "block",
  fontSize: "14px",
  fontWeight: "bold" as const,
  marginBottom: "8px",
  color: "#555",
};

export function ElementoLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Elemento de Limpieza",
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

      {/* 1. Nombre */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>
          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Detergente Multiuso"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* 2. Fecha Último Recambio */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            FECHA ÚLTIMO RECAMBIO *
          </Box>
          <Input
            type="date"
            value={values.fecha_ultimo_recambio ?? ""}
            onChange={handleFechaChange}
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* 3. Frecuencia de Recambio (Días) */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root>
          <Box as="label" style={estiloLabel}>
            FRECUENCIA RECAMBIO (DÍAS)
          </Box>
          <Input
            type="number"
            min={1}
            value={values.frecuencia_recambio_dias ?? ""}
            onChange={handleFrecuenciaChange}
            placeholder="Ej: 30"
            style={estiloInput}
          />
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