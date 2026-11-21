import { useState } from "react";
import type { TransportistaFormValues } from "../types/transportista";
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
import { Textarea } from "@chakra-ui/react";

interface TransportistaFormProps {
  initialValues?: TransportistaFormValues;
  onSubmit: (values: TransportistaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: TransportistaFormValues = {
  razon_social: "",
  cuit: "",
  telefono: "",
  email: "",
  domicilio: "",
  observaciones: "",
};

export function TransportistaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: TransportistaFormProps) {
  const [values, setValues] = useState<TransportistaFormValues>(initialValues);
  const faltan = faltantes({
    razon_social: [!values.razon_social.trim(), "la razón social"],
    cuit: [!values.cuit.trim(), "el CUIT"],
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
          <FormField invalid={intentado && faltan.tiene("razon_social")} label="Razón social" required completo>
            <FormInput
              value={values.razon_social}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, razon_social: e.target.value }))
              }
              placeholder="Ej: Transporte del Norte S.A."
            />
          </FormField>

          <FormField invalid={intentado && faltan.tiene("cuit")} label="CUIT" required>
            <FormInput
              value={values.cuit}
              onChange={(e) => setValues((prev) => ({ ...prev, cuit: e.target.value }))}
              placeholder="Ej: 20-12345678-9"
            />
          </FormField>

          <FormField invalid={intentado && faltan.tiene("telefono")} label="Teléfono" required>
            <FormInput
              value={values.telefono}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, telefono: e.target.value }))
              }
              placeholder="Ej: 11-2233-4455"
            />
          </FormField>

          <FormField label="Email">
            <FormInput
              value={values.email ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, email: e.target.value || null }))
              }
              placeholder="Ej: choferes@transportista.com"
            />
          </FormField>

          <FormField label="Domicilio">
            <FormInput
              value={values.domicilio ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, domicilio: e.target.value || null }))
              }
              placeholder="Ej: Av. Ruta 9 Km 123, CABA"
            />
          </FormField>
          <FormField label="Observaciones" opcional completo>
          <Textarea
            value={values.observaciones ?? ""}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                observaciones: e.target.value || null,
              }))
            }
            placeholder="Ej: Solo circula de día, vehículo con GPS"
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
