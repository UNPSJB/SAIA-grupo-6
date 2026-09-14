import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
} from "@chakra-ui/react";
import { TIPO_EQUIPO_OPTIONS, type Equipo } from "../types/equipo";

type EquipoFormValues = Omit<Equipo, "id">;

interface EquipoFormProps {
  initialValues?: EquipoFormValues;
  onSubmit: (values: EquipoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: EquipoFormValues = { nombre: "", tipo: "heladera", ubicacion:"", activo:true, };

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

export function EquipoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Equipo",
  onCancel,
}: EquipoFormProps) {
  const [values, setValues] = useState<EquipoFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as EquipoFormValues["tipo"],
    }));


  const handleUbicacionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, ubicacion: e.target.value }));

  //const handleActivoChange = (e: React.ChangeEvent<HTMLInputElement>) =>
   // setValues((prev) => ({ ...prev, activo: e.target.checked }));

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

      {/* 2. Tipo de Equipo */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE EQUIPO *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              {TIPO_EQUIPO_OPTIONS.map((tipo) => (
                <option
                  key={tipo}
                  value={tipo}
                  style={{ backgroundColor: "#fff", color: "#333" }}
                >
                  {tipo}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      {/* 3. Ubicación */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            UBICACIÓN *
          </Box>
          <Input
            value={values.ubicacion}
            onChange={handleUbicacionChange}
            placeholder="Ej: Sector A - Laboratorio"
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
