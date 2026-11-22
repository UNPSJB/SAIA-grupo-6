import { useState } from "react";
import { Textarea } from "@chakra-ui/react";
import type { AptitudFormValues } from "../types/aptitud";
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

interface AptitudFormProps {
  initialValues?: AptitudFormValues;
  onSubmit: (values: AptitudFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: AptitudFormValues = { nombre: "", descripcion: "" };

/**
 * El aspecto de los controles lo dan `FormInput` y la receta del tema; acá no
 * hay objetos de estilo. El layout lo dan las piezas de `formularios.tsx`.
 */
export function AptitudForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: AptitudFormProps) {
  const [values, setValues] = useState<AptitudFormValues>(initialValues);
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
              placeholder="Ej: Carnet de Manipulador"
            />
          </FormField>

          <FormField label="Descripción" opcional helper="Qué certifica esta aptitud.">
            <Textarea
              value={values.descripcion || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Qué certifica esta aptitud."
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
