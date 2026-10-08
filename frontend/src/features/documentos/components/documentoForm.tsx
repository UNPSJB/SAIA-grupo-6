import { useState } from "react";
import { Box, Field, Heading, Input, NativeSelect } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
} from "../../../components/ui/patrones";
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

/**
 * El aspecto de los campos lo aporta la receta `input` del tema
 * (`src/theme/index.ts`), así que acá no hay ningún objeto de estilo: solo
 * queda el `maxW`, que es una decisión de layout.
 */
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
      bg="white"
      p="8"
      rounded="xl"
      boxShadow="card"
      mb="8"
    >
      <Heading as="h3" size="lg" mt={0} color="brand.500" mb="5">
        {title}
      </Heading>

      {conDatosDelDocumento && (
        <>
          <Field.Root required mb="5">
            <Field.Label color="gray.600">NOMBRE DEL DOCUMENTO *</Field.Label>
            <Input
              value={values.nombre}
              onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Manual de BPM"
              maxW="500px"
            />
          </Field.Root>

          <Field.Root required mb="5">
            <Field.Label color="gray.600">TIPO *</Field.Label>
            <NativeSelect.Root>
              <NativeSelect.Field
                value={values.tipo}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, tipo: e.target.value as TipoDocumento }))
                }
                maxW="500px"
                bg="white"
                borderWidth="2px"
                borderColor="brand.300"
                borderRadius="lg"
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>
        </>
      )}

      <Field.Root required mb="6">
        <Field.Label color="gray.600">ARCHIVO *</Field.Label>
        <Input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) =>
            setValues((prev) => ({ ...prev, archivo: e.target.files?.[0] ?? null }))
          }
          maxW="500px"
        />
      </Field.Root>

      <AccionesFormulario>
        <BotonGuardar loading={isLoading} disabled={incompleto}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}