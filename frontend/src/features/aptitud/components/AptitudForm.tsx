import { useState } from "react";
import { Box, Button, Field, HStack, Input, Textarea } from "@chakra-ui/react";
import type { AptitudFormValues } from "../types/aptitud";
import {
  BLANCO,
  GRIS_CLARO,
  TEAL,
  TEXTO_PRIMARIO,
  estiloInput,
  estiloLabel,
} from "../../../common/theme/tokens";

interface AptitudFormProps {
  initialValues?: AptitudFormValues;
  onSubmit: (values: AptitudFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: AptitudFormValues = { nombre: "", descripcion: "" };

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
    <Box
      as="form"
      onSubmit={handleSubmit}
      style={{ backgroundColor: BLANCO, padding: "30px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "30px" }}
    >
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: TEAL }}>{title}</Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>NOMBRE *</Box>
          <Input
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Carnet de Manipulador"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root>
          <Box as="label" style={estiloLabel}>DESCRIPCIÓN</Box>
          <Textarea
            value={values.descripcion || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Opcional: qué certifica esta aptitud"
            style={{ ...estiloInput, minHeight: "80px" }}
          />
        </Field.Root>
      </Box>

      <HStack style={{ gap: "15px" }}>
        <Button type="submit" loading={isLoading} style={{ backgroundColor: TEAL, color: "white", padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "bold" }}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} style={{ backgroundColor: GRIS_CLARO, color: TEXTO_PRIMARIO, padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "bold" }}>
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}