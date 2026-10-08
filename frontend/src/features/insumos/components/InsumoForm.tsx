import { useEffect, useState } from "react";
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
import type { InsumoFormValues } from "../types/insumo";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";

interface InsumoFormProps {
  initialValues?: InsumoFormValues;
  onSubmit: (values: InsumoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: InsumoFormValues = { nombre: "", unidad_medida_id: 0 };

export function InsumoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de insumo",
  onCancel,
}: InsumoFormProps) {
  const [values, setValues] = useState<InsumoFormValues>(initialValues);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [cargandoUnidades, setCargandoUnidades] = useState(true);

  useEffect(() => {
    const cargarUnidades = async () => {
      try {
        const data = await listarUnidadesMedida(false);
        setUnidades(data);
      } catch (err) {
        console.error("Error al cargar unidades de medida:", err);
      } finally {
        setCargandoUnidades(false);
      }
    };
    cargarUnidades();
  }, []);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleUnidadChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      unidad_medida_id: Number(e.target.value),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      <FormField label="Nombre" required>
        <FormInput
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Fertilizante nitrogenado"
          maxW="500px"
        />
      </FormField>

      <FormField label="Unidad de medida" required mb="0">
        <FormNativeSelect
          value={values.unidad_medida_id}
          onChange={handleUnidadChange}
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
        <BotonGuardar loading={isLoading} disabled={!values.unidad_medida_id}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}