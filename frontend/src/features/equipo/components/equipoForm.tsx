import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  Switch,
} from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";

type EquipoFormValues = Omit<Equipo, "id">;

interface EquipoFormProps {
  initialValues?: EquipoFormValues;
  onSubmit: (values: EquipoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
  mostrarBaja?: boolean;
}

const emptyValues: EquipoFormValues = {
  nombre: "",
  tipo: "",
  ubicacion: "",
  activo: true,
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

export function EquipoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Equipo",
  onCancel,
  mostrarBaja = false,
}: EquipoFormProps) {
  const [values, setValues] = useState<EquipoFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      nombre: e.target.value,
    }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value,
    }));

  const handleUbicacionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      ubicacion: e.target.value,
    }));

  const handleBajaChange = (checked: boolean) => {
    setValues((prev) => ({
      ...prev,
      activo: !checked,
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

      {/* Nombre */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>

          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Heladera industrial"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* Tipo */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Field.Label style={estiloLabel}>
            TIPO *
          </Field.Label>

          <Input
            value={values.tipo}
            onChange={handleTipoChange}
            placeholder="Ej: Heladera, horno, freidora..."
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* Ubicación */}
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

      {/* Dar de baja - solo aparece al modificar */}
      {mostrarBaja && (
        <Box style={{ marginBottom: "25px" }}>
          <Switch.Root
            checked={!values.activo}
            onCheckedChange={(details) =>
              handleBajaChange(details.checked)
            }
          >
            <Switch.HiddenInput />
            <Switch.Control 
              bg={values.activo ? "green.500" : "red.500"}
              _checked={{
                bg: "red.500",
              }}
            />
            <Switch.Label
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#555",
              }}
            >
              Dar de baja
            </Switch.Label>
          </Switch.Root>
        </Box>
      )}

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