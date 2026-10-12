import { useState } from "react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  TarjetaFormulario,
  TituloFormulario,
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

const emptyValues: DocumentoFormValues = {
  nombre: "",
  tipo: "manual_bpm",
  archivo: null,
  fecha_vencimiento: "",
};


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
    <TarjetaFormulario as="form" onSubmit={handleSubmit} mb="0">
      <TituloFormulario>{title}</TituloFormulario>

      {conDatosDelDocumento && (
        <>
          <FormField label="Nombre del documento" required>
            <FormInput
              value={values.nombre}
              onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej: Manual de BPM"
              maxW="500px"
            />
          </FormField>

          <FormField label="Tipo" required>
            <FormNativeSelect
              value={values.tipo}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, tipo: e.target.value as TipoDocumento }))
              }
              maxW="500px"
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
        </>
      )}
      <FormField
        label="Fecha de vencimiento"
        helper="Opcional. El documento se marcará como vencido después de esta fecha."
      >
        <FormInput
          type="date"
          value={values.fecha_vencimiento}
          onChange={(e) =>
            setValues((prev) => ({
              ...prev,
              fecha_vencimiento: e.target.value,
            }))
          }
          maxW="500px"
        />
      </FormField>
      
      <FormField
        label="Archivo"
        required
        helper="Formatos admitidos: PDF, Word, Excel, PNG y JPG."
        mb="0"
      >
        <FormInput
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) =>
            setValues((prev) => ({ ...prev, archivo: e.target.files?.[0] ?? null }))
          }
          p="2"
          maxW="500px"
        />
      </FormField>

      <AccionesFormulario>
        <BotonGuardar loading={isLoading} disabled={incompleto}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}