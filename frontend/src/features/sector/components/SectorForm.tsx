import { useState } from "react";
import { Box, Textarea } from "@chakra-ui/react";
import type { SectorFormValues } from "../types/sector";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  faltantes,
  FormField,
  FormInput,
  SIN_VALIDACION_NATIVA,
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
} from "../../../components/ui/patrones";

interface SectorFormProps {
  initialValues?: SectorFormValues;
  onSubmit: (values: SectorFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: SectorFormValues = { nombre: "", descripcion: "" };

export function SectorForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Sector",
  onCancel,
}: SectorFormProps) {
  const [values, setValues] = useState<SectorFormValues>(initialValues);
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };

  return (
    <Box as="form" onSubmit={handleSubmit} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required mb="4">
          <FormInput
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Cocina"
            maxW="500px"
          />
        </FormField>

        <FormField
          label="Descripción"
          helper="Opcional: qué se hace en este sector."
          mb="0"
        >
          <Textarea
            value={values.descripcion || ""}
            onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Opcional: qué se hace en este sector"
            minH="80px"
            maxW="500px"
          />
        </FormField>

        <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
        <AccionesFormulario>
          <BotonGuardar loading={isLoading}>
            {submitLabel}
          </BotonGuardar>
          {onCancel && (
            <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>
          )}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}