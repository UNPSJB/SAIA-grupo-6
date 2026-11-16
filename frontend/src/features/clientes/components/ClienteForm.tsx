import { useState } from "react";
import { Box } from "@chakra-ui/react";
import type { ClienteFormValues } from "../types/cliente";
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

interface ClienteFormProps {
  initialValues?: ClienteFormValues;
  onSubmit: (values: ClienteFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
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
  title = "Alta de cliente",
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
    <Box as="form" onSubmit={handleSubmit} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField
          invalid={intentado && faltan.tiene("nombre")}
          label="Nombre"
          required
          mb="4"
        >
          <FormInput
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Supermercado Centro"
            maxW="500px"
          />
        </FormField>

        <FormField
          invalid={intentado && faltan.tiene("documento")}
          label="Documento (DNI o CUIT)"
          required
          mb="4"
        >
          <FormInput
            value={values.documento}
            onChange={(e) => setValues((prev) => ({ ...prev, documento: e.target.value }))}
            placeholder="Ej: 12345678 (DNI) o 20123456789 (CUIT)"
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
            onChange={(e) => setValues((prev) => ({ ...prev, telefono: e.target.value }))}
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
            placeholder="Ej: contacto@cliente.com"
            maxW="500px"
          />
        </FormField>

        <FormField label="Domicilio" mb="0">
          <FormInput
            value={values.domicilio ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, domicilio: e.target.value || null }))
            }
            placeholder="Ej: Av. Siempre Viva 123, CABA"
            maxW="500px"
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
