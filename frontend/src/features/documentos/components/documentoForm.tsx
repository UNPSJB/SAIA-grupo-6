import { useState } from "react";
import { Box, Button, Field, HStack, Input, NativeSelect } from "@chakra-ui/react";
import { TIPOS_DOCUMENTO } from "../types/documento";
import type { DocumentoFormValues, TipoDocumento } from "../types/documento";

interface DocumentoFormProps {
  conDatosDelDocumento?: boolean; // true = alta (nombre + tipo), false = nueva versión
  onSubmit: (values: DocumentoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: DocumentoFormValues = { nombre: "", tipo: "manual_bpm", archivo: null };

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

export function DocumentoForm({
  conDatosDelDocumento = true,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Subir documento",
  onCancel,
}: DocumentoFormProps) {
  const [values, setValues] = useState<DocumentoFormValues>(emptyValues);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const incompleto = !values.archivo || (conDatosDelDocumento && !values.nombre.trim());

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

      {conDatosDelDocumento && (
        <>
          <Box style={{ marginBottom: "20px" }}>
            <Field.Root required>
              <Box as="label" style={estiloLabel}>NOMBRE DEL DOCUMENTO *</Box>
              <Input
                value={values.nombre}
                onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Manual de BPM"
                style={estiloInput}
              />
            </Field.Root>
          </Box>

          <Box style={{ marginBottom: "20px" }}>
            <Field.Root required>
              <Box as="label" style={estiloLabel}>TIPO *</Box>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={values.tipo}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, tipo: e.target.value as TipoDocumento }))
                  }
                  style={estiloSelect}
                >
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t.value} value={t.value} style={{ backgroundColor: "#fff", color: "#333" }}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </Box>
        </>
      )}

      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>ARCHIVO *</Box>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) =>
              setValues((prev) => ({ ...prev, archivo: e.target.files?.[0] ?? null }))
            }
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          disabled={incompleto}
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