import { useState } from "react";
import { LuUpload } from "react-icons/lu";
import {
  faltantes,
  FormField,
  FormInput,
  FormNativeSelect,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  InputFecha,
  SeccionFormulario,
} from "../../../components/ui/formularios";
import { TIPOS_DOCUMENTO } from "../types/documento";
import type { DocumentoFormValues, TipoDocumento } from "../types/documento";

interface DocumentoFormProps {
  conDatosDelDocumento?: boolean; // true = alta (nombre + tipo), false = nueva versión
  onSubmit: (values: DocumentoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
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
  onCancel,
}: DocumentoFormProps) {
  const [values, setValues] = useState<DocumentoFormValues>(emptyValues);

  const faltan = faltantes({
    nombre: [conDatosDelDocumento && !values.nombre.trim(), "el nombre del documento"],
    archivo: [!values.archivo, "el archivo"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };

  return (
    <FormularioAlta onSubmit={handleSubmit} sinValidacionNativa mb="0">
      <SeccionFormulario>
        <GrillaFormulario>
          {conDatosDelDocumento && (
            <>
              <FormField label="Nombre del documento" required invalid={intentado && faltan.tiene("nombre")} completo>
                <FormInput
                  value={values.nombre}
                  onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Manual de BPM"
                />
              </FormField>

              <FormField label="Tipo" required>
                <FormNativeSelect
                  value={values.tipo}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, tipo: e.target.value as TipoDocumento }))
                  }
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
            opcional
            helper="El documento se marcará como vencido después de esta fecha."
          >
            <InputFecha
              value={values.fecha_vencimiento}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  fecha_vencimiento: e.target.value,
                }))
              }
            />
          </FormField>

          <FormField
            label="Archivo"
            required
            invalid={intentado && faltan.tiene("archivo")}
            helper="Formatos admitidos: PDF, Word, Excel, PNG y JPG."
            completo
          >
            <FormInput
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) =>
                setValues((prev) => ({ ...prev, archivo: e.target.files?.[0] ?? null }))
              }
              p="2"
            />
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <AccionesAlta
        etiqueta={submitLabel}
        icono={LuUpload}
        guardando={isLoading}
        onCancelar={onCancel}
        faltantes={faltan.lista}
        mostrarFaltantes={intentado}
      />
    </FormularioAlta>
  );
}