import { useState } from "react";
import { Box, Button, Field, HStack, Input, Textarea } from "@chakra-ui/react";
import type { AptitudFormValues } from "../types/aptitud";

interface AptitudFormProps {
  initialValues?: AptitudFormValues;
  onSubmit: (values: AptitudFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: AptitudFormValues = { nombre: "", descripcion: "" };

/**
 * Estilo de input de formulario, expresado con tokens del tema.
 * Reemplaza al objeto `estiloInput` de tokens.ts. Cuando el resto de
 * las features migre, esto sube a una receta del tema.
 */
const propsFormulario = {
  input: {
    w: "100%",
    maxW: "500px",
    p: "3",
    rounded: "lg",
    borderWidth: "2px",
    borderColor: "brand.300",
    _focus: { borderColor: "brand.500" },
  },
} as const;

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
      bg="white"
      p="8"
      rounded="xl"
      boxShadow="0 4px 6px rgba(0,0,0,0.05)"
      mb="8"
    >
      <Box as="h3" mt={0} fontSize="22px" color="brand.500" fontWeight="bold" mb="5">{title}</Box>

      <Box mb="5">
        <Field.Root required>
          <Field.Label display="block" fontSize="14px" fontWeight="bold" mb="2" color="gray.600">NOMBRE *</Field.Label>
          <Input
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Carnet de Manipulador"
            {...propsFormulario.input}
          />
        </Field.Root>
      </Box>

      <Box mb="5">
        <Field.Root>
          <Field.Label display="block" fontSize="14px" fontWeight="bold" mb="2" color="gray.600">DESCRIPCIÓN</Field.Label>
          <Textarea
            value={values.descripcion || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Opcional: qué certifica esta aptitud"
            minH="80px"
            {...propsFormulario.input}
          />
        </Field.Root>
      </Box>

      <HStack gap="15px">
        <Button
          type="submit"
          loading={isLoading}
          colorPalette="brand"
          rounded="lg"
          fontWeight="bold"
          px="6"
          py="3"
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            bg="gray.200"
            color="gray.800"
            rounded="lg"
            fontWeight="bold"
            px="6"
            py="3"
            _hover={{ bg: "gray.300" }}
          >
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}