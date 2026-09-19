import { useState } from "react";
import { Box, Button, Field, HStack, Input } from "@chakra-ui/react";
import type { Persona } from "../types/personal";

type PersonalFormValues = Omit<Persona, "id" | "activo" | "fecha_creacion" | "fecha_actualizacion">;

interface PersonalFormProps {
  initialValues?: PersonalFormValues;
  onSubmit: (values: PersonalFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: PersonalFormValues = { nombre: "", apellido: "", dni: "", email: "", telefono: "", puede_operar: false, puede_administrar: false };

const estiloInput = { backgroundColor: "#fff", padding: "12px", width: "100%", borderRadius: "8px", border: "2px solid #90BEBB", fontSize: "16px", outline: "none", color: "#333" };
const estiloLabel = { display: "block", fontSize: "14px", fontWeight: "bold" as const, marginBottom: "8px", color: "#555" };

export function PersonalForm({ initialValues = emptyValues, onSubmit, isLoading = false, submitLabel = "Guardar", title = "Formulario de Personal", onCancel }: PersonalFormProps) {
  const [values, setValues] = useState<PersonalFormValues>(initialValues);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...values,
      apellido: values.apellido || null,
      telefono: values.telefono || null
    });
  };

  return (
    <Box as="form" onSubmit={handleSubmit} style={{ backgroundColor: "#ffffff", padding: "30px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: "#468189", marginBottom: "20px" }}>{title}</Box>

      <HStack gap="20px" mb="20px">
        <Field.Root required>
          <Box as="label" style={estiloLabel}>NOMBRE *</Box>
          <Input value={values.nombre} onChange={(e) => setValues({ ...values, nombre: e.target.value })} style={estiloInput} />
        </Field.Root>
        <Field.Root>
          <Box as="label" style={estiloLabel}>APELLIDO</Box>
          <Input value={values.apellido || ""} onChange={(e) => setValues({ ...values, apellido: e.target.value })} style={estiloInput} />
        </Field.Root>
      </HStack>

      <HStack gap="20px" mb="20px">
        <Field.Root required>
          <Box as="label" style={estiloLabel}>DNI (7 u 8 dígitos)*</Box>
          <Input value={values.dni} maxLength={8} onChange={(e) => setValues({ ...values, dni: e.target.value })} style={estiloInput} />
        </Field.Root>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>EMAIL *</Box>
          <Input type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} style={estiloInput} />
        </Field.Root>
      </HStack>

      <Box mb="20px">
        <Field.Root>
          <Box as="label" style={estiloLabel}>TELÉFONO</Box>
          <Input value={values.telefono || ""} onChange={(e) => setValues({ ...values, telefono: e.target.value })} style={estiloInput} />
        </Field.Root>
      </Box>

      <HStack gap="25px" mb="25px">
        <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={values.puede_operar} onChange={(e) => setValues({ ...values, puede_operar: e.target.checked })} style={{ width: "18px", height: "18px" }} /> Operar
        </label>
        <label style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={values.puede_administrar} onChange={(e) => setValues({ ...values, puede_administrar: e.target.checked })} style={{ width: "18px", height: "18px" }} /> Administrar
        </label>
      </HStack>

      <HStack style={{ gap: "15px" }}>
        <Button type="submit" loading={isLoading} style={{ backgroundColor: "#468189", color: "white", padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" onClick={onCancel} style={{ backgroundColor: "#e0e0e0", color: "#333", padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}