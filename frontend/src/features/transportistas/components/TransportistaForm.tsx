import { useState } from "react";
import { Box } from "@chakra-ui/react";
import type { TransportistaFormValues } from "../types/transportista";
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
import { Textarea } from "@chakra-ui/react";

interface TransportistaFormProps {
  initialValues?: TransportistaFormValues;
  onSubmit: (values: TransportistaFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
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
  title = "Alta de transportista",
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
    <Box as="form" onSubmit={handleSubmit} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField
          invalid={intentado && faltan.tiene("razon_social")}
          label="Razón Social"
          required
          mb="4"
        >
          <FormInput
            value={values.razon_social}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, razon_social: e.target.value }))
            }
            placeholder="Ej: Transporte del Norte S.A."
            maxW="500px"
          />
        </FormField>

        <FormField
          invalid={intentado && faltan.tiene("cuit")}
          label="CUIT"
          required
          mb="4"
        >
          <FormInput
            value={values.cuit}
            onChange={(e) => setValues((prev) => ({ ...prev, cuit: e.target.value }))}
            placeholder="Ej: 20-12345678-9"
            maxW="500px"
          />
        </FormField>

        <FormField
          invalid={intentado && faltan.tiene("telefono")}
          label="Teléfono"
          required
          mb="4"
        >
          <FormInput
            value={values.telefono}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, telefono: e.target.value }))
            }
            placeholder="Ej: 11-2233-4455"
            maxW="500px"
          />
        </FormField>

        <FormField label="Email" mb="4">
          <FormInput
            value={values.email ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, email: e.target.value || null }))
            }
            placeholder="Ej: choferes@transportista.com"
            maxW="500px"
          />
        </FormField>

        <FormField label="Domicilio" mb="4">
          <FormInput
            value={values.domicilio ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, domicilio: e.target.value || null }))
            }
            placeholder="Ej: Av. Ruta 9 Km 123, CABA"
            maxW="500px"
          />
        </FormField>

        <FormField label="Observaciones" mb="0">
          <Textarea
            value={values.observaciones ?? ""}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                observaciones: e.target.value || null,
              }))
            }
            placeholder="Ej: Solo circula de día, vehículo con GPS"
            maxW="500px"
            h="16"
          />
        </FormField>

        <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
        <AccionesFormulario>
          <BotonGuardar loading={isLoading}>
            {submitLabel}
          </BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
