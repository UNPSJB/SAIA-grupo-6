import { useState } from "react";
import type { ClienteFormValues } from "../types/cliente";
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

interface ClienteFormProps {
  initialValues?: ClienteFormValues;
  onSubmit: (values: ClienteFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: ClienteFormValues = {
  nombre: "",
  documento: "",
  telefono: "",
  email: "",
  domicilio: "",
};

export function ClienteForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: ClienteFormProps) {
  const [values, setValues] = useState<ClienteFormValues>(initialValues);
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    documento: [!values.documento.trim(), "el documento (DNI o CUIT)"],
    telefono: [!values.telefono.trim(), "el teléfono"],
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
        <GrillaFormulario>
          <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required completo>
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Supermercado Centro"
            />
          </FormField>

          <FormField invalid={intentado && faltan.tiene("documento")} label="Documento (DNI o CUIT)" required>
            <FormInput
              value={values.documento}
              onChange={(e) => setValues((prev) => ({ ...prev, documento: e.target.value }))}
              placeholder="Ej: 12345678 o 20123456789"
            />
          </FormField>

          <FormField invalid={intentado && faltan.tiene("telefono")} label="Teléfono" required>
            <FormInput
              value={values.telefono}
              onChange={(e) => setValues((prev) => ({ ...prev, telefono: e.target.value }))}
              placeholder="Ej: 11-2233-4455"
            />
          </FormField>

          <FormField label="Email">
            <FormInput
              value={values.email ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, email: e.target.value || null }))
              }
              placeholder="Ej: contacto@cliente.com"
            />
          </FormField>

          <FormField label="Domicilio">
            <FormInput
              value={values.domicilio ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, domicilio: e.target.value || null }))
              }
              placeholder="Ej: Av. Siempre Viva 123, CABA"
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
