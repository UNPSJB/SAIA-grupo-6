import { useEffect, useState } from "react";
import { Box } from "@chakra-ui/react";
import {
  AccionesFormulario,
  AvisoFaltantes,
  BotonCancelar,
  BotonGuardar,
  faltantes,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  SIN_VALIDACION_NATIVA,
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
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
    <Box as="form" onSubmit={handleSubmit} {...SIN_VALIDACION_NATIVA}>
      <TarjetaFormulario>
        <TituloFormulario>{title}</TituloFormulario>

        <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required mb="4">
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

        <FormField invalid={intentado && faltan.tiene("unidad")}
          label="Unidad de medida"
          required
          mb="0"
          helper="Unidad en la que se mide lo que se produce (por ejemplo kg o litros)."
        >
          <FormNativeSelect
            invalid={intentado && faltan.tiene("unidad")}
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

        <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
        <AccionesFormulario>
          <BotonGuardar
            loading={isLoading}
          >
            {submitLabel}
          </BotonGuardar>
          {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
        </AccionesFormulario>
      </TarjetaFormulario>
    </Box>
  );
}
