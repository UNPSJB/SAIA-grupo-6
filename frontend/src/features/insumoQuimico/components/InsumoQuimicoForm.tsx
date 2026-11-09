import { useState, useEffect } from "react";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimicoFormValues,
  type TipoQuimico,
} from "../types/insumoQuimico";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
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
  TarjetaFormulario,
  TituloFormulario,
  useIntentoEnvio,
} from "../../../components/ui/patrones";

interface InsumoQuimicoFormProps {
  initialValues?: InsumoQuimicoFormValues;
  onSubmit: (values: InsumoQuimicoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: InsumoQuimicoFormValues = {
  nombre: "",
  tipo: "detergente",
  unidad_medida_id: 0,
};

export function InsumoQuimicoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de insumo químico",
  onCancel,
}: InsumoQuimicoFormProps) {
  const [values, setValues] = useState<InsumoQuimicoFormValues>(initialValues);
  const faltan = faltantes({
    nombre: [!values.nombre.trim(), "el nombre"],
    unidad: [!values.unidad_medida_id, "la unidad de medida"],
  });
  const { intentado, puedeEnviar } = useIntentoEnvio();
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
    setValues((prev) => ({
      ...prev,
      nombre: e.target.value,
    }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value as TipoQuimico,
    }));

  const handleUnidadChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      unidad_medida_id: Number(e.target.value),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeEnviar(faltan.lista)) return;
    onSubmit(values);
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      <FormField invalid={intentado && faltan.tiene("nombre")} label="Nombre" required>
        <FormInput
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Detergente industrial concentrado"
          maxW="500px"
        />
      </FormField>

      <FormField label="Tipo de producto químico" required>
        <FormNativeSelect
          value={values.tipo}
          onChange={handleTipoChange}
          maxW="500px"
        >
          {TIPOS_QUIMICOS.map((tipo) => (
            <option key={tipo.value} value={tipo.value}>
              {tipo.label}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      <FormField invalid={intentado && faltan.tiene("unidad")} label="Unidad de medida" required mb="0">
        <FormNativeSelect
          invalid={intentado && faltan.tiene("unidad")}
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

      <AvisoFaltantes visible={intentado} faltantes={faltan.lista} />
      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}