import { ConservacionFields } from "../../rotulado/components/ConservacionFields";
import { useEffect, useState } from "react";
import {
  faltantes,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  useIntentoEnvio,
} from "../../../components/ui/patrones";
import {
  AccionesAlta,
  FormularioAlta,
  GrillaFormulario,
  SeccionFormulario,
} from "../../../components/ui/formularios";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import type { ProductoFormValues } from "../types/producto";

interface ProductoFormProps {
  initialValues?: ProductoFormValues;
  onSubmit: (values: ProductoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

const emptyValues: ProductoFormValues = { nombre: "", descripcion: "", unidad_medida_id: 0 };

export function ProductoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  onCancel,
}: ProductoFormProps) {
  const [values, setValues] = useState<ProductoFormValues>(initialValues);
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    unidad: [!values.unidad_medida_id, "la unidad de medida"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);

  useEffect(() => {
    listarUnidadesMedida(false)
      .then(setUnidades)
      .catch((err) => console.error("Error al cargar unidades de medida:", err))
      .finally(() => setCargandoUnidades(false));
  }, []);

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
              placeholder="Ej: Mermelada de frutilla"
            />
          </FormField>

          <FormField label="Descripción" opcional completo>
            <FormInput
              value={values.descripcion}
              onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            />
          </FormField>

          <FormField
            invalid={intentado && faltan.tiene("unidad")}
            label="Unidad de medida"
            required
            helper="Unidad en la que se mide lo que se produce (por ejemplo kg o litros)."
          >
            <FormNativeSelect
              invalid={intentado && faltan.tiene("unidad")}
              value={values.unidad_medida_id}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, unidad_medida_id: Number(e.target.value) }))
              }
              disabled={cargandoUnidades}
            >
              <SelectPlaceholder>
                {cargandoUnidades ? "Cargando..." : "Seleccioná una unidad"}
              </SelectPlaceholder>
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.nombre} ({unidad.simbolo})
                </option>
              ))}
            </FormNativeSelect>
          </FormField>
        </GrillaFormulario>
      </SeccionFormulario>
      <SeccionFormulario
        titulo="Conservación"
        ayuda="Se copia a la declaración del rótulo; ahí se puede ajustar por borrador."
      >
        <ConservacionFields
          value={values.conservacion ?? null}
          onChange={(v) => setValues((prev) => ({ ...prev, conservacion: v }))}
        />
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
