import { useState } from "react";
import { Textarea } from "@chakra-ui/react";
import type { SectorFormValues } from "../types/sector";
import {
  faltantes,
  FormField,
  FormInput,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  SeccionFormulario,
} from "../../../components/ui/formularios";

interface SectorFormProps {
  initialValues?: SectorFormValues;
  onSubmit: (values: SectorFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: SectorFormValues = { nombre: "", descripcion: "" };

export function SectorForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
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
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
      <SeccionFormulario>
        <GrillaFormulario columnas={1}>
          <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required>
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Cocina"
            />
          </FormField>

          <FormField label="Descripción" opcional helper="Qué se hace en este sector.">
            <Textarea
              value={values.descripcion || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Qué se hace en este sector."
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <AccionesAlta
        etiqueta={submitLabel}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltan.lista}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}