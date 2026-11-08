import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import type { ProductoFormValues } from "../types/producto";

interface ProductoFormProps {
  initialValues?: ProductoFormValues;
  onSubmit: (values: ProductoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: ProductoFormValues = { nombre: "", descripcion: "", unidad_medida_id: 0 };

export function ProductoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de producto",
  onCancel,
}: ProductoFormProps) {
  const [values, setValues] = useState<ProductoFormValues>(initialValues);
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
    onSubmit(values);
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField label="Nombre" required mb="4">
          <FormInput
            value={values.nombre}
            onChange={(e) => setValues((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="Ej: Mermelada de frutilla"
            maxW="500px"
          />
        </FormField>

        <FormField label="Descripción" mb="4">
          <FormInput
            value={values.descripcion}
            onChange={(e) => setValues((prev) => ({ ...prev, descripcion: e.target.value }))}
            placeholder="Opcional"
            maxW="500px"
          />
        </FormField>

        <FormField
          label="Unidad de medida"
          required
          mb="0"
          helper="Unidad en la que se mide lo que se produce (por ejemplo kg o litros)."
        >
          <FormNativeSelect
            value={values.unidad_medida_id}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, unidad_medida_id: Number(e.target.value) }))
            }
            disabled={cargandoUnidades}
            maxW="500px"
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

        <AccionesFormulario>
          <BotonGuardar
            loading={isLoading}
            disabled={!values.nombre.trim() || !values.unidad_medida_id}
          >
            {submitLabel}
          </BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
