import { useState } from "react";
import { Checkbox } from "@chakra-ui/react";
import type { ProveedorFormValues } from "../types/proveedor";
import {
  faltantes,
  FormField,
  FormInput,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  CeldaCompleta,
  FormularioAlta,
  GrillaFormulario,
  SeccionFormulario,
} from "../../../components/ui/formularios";

interface ProveedorFormProps {
  initialValues?: ProveedorFormValues;
  onSubmit: (values: ProveedorFormValues) => Promise<void> | void;
  isLoading?: boolean; submitLabel?: string; onCancel?: () => void;
}
const emptyValues: ProveedorFormValues = {
  nombre: "", cuit: "", contacto: "", domicilio: "", rubro: "", es_certificado: false,
};
export function ProveedorForm({ initialValues = emptyValues, onSubmit, isLoading = false,
  submitLabel = "Guardar", onCancel }: ProveedorFormProps) {
  const [values, setValues] = useState<ProveedorFormValues>(initialValues);
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    cuit: [!values.cuit.trim(), "el CUIT"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();
  const set = (campo: keyof ProveedorFormValues, valor: string | boolean) =>
    setValues((prev) => ({ ...prev, [campo]: valor }));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };
  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa>
      <SeccionFormulario>
        <GrillaFormulario>
          <FormField invalid={intentado && faltan.tiene("nombre")} label="Razón social / nombre" required completo>
            <FormInput value={values.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Alimentos del Sur S.A." />
          </FormField>
          <FormField invalid={intentado && faltan.tiene("cuit")} label="CUIT" required helper="Se utiliza para evitar duplicados.">
            <FormInput value={values.cuit} onChange={(e) => set("cuit", e.target.value)} placeholder="30-12345678-9" />
          </FormField>
          <FormField label="Rubro">
            <FormInput value={values.rubro} onChange={(e) => set("rubro", e.target.value)} placeholder="Ej: Lácteos, materias primas..." />
          </FormField>
          <FormField label="Contacto">
            <FormInput value={values.contacto} onChange={(e) => set("contacto", e.target.value)} placeholder="Teléfono o correo electrónico" />
          </FormField>
          <FormField label="Domicilio">
            <FormInput value={values.domicilio} onChange={(e) => set("domicilio", e.target.value)} />
          </FormField>
          <CeldaCompleta>
            <Checkbox.Root checked={values.es_certificado} onCheckedChange={(e) => set("es_certificado", !!e.checked)}>
              <Checkbox.HiddenInput />
              <Checkbox.Control />
              <Checkbox.Label>Proveedor con certificación requerida</Checkbox.Label>
            </Checkbox.Root>
          </CeldaCompleta>
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
