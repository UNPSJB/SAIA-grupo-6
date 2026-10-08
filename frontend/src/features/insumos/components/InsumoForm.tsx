import { useEffect, useState } from "react";
import { Box, Field, Input, NativeSelect } from "@chakra-ui/react";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
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

/**
 * El aspecto del input lo aporta la receta `input` del tema
 * (`src/theme/index.ts`), así que acá no hay ningún objeto de estilo. El
 * ancho sí es una decisión de layout y queda como prop del call site.
 */
export function InsumoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Insumo",
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
    <Box
      as="form"
      onSubmit={handleSubmit}
      bg="white"
      p="8"
      rounded="xl"
      boxShadow="card"
      mb="8"
    >
      <Box
        as="h3"
        mt={0}
        fontSize="2xl"
        fontWeight="bold"
        color="brand.500"
        mb="6"
      >
        {title}
      </Box>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">NOMBRE *</Field.Label>
        <Input
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Fertilizante nitrogenado"
          maxW="500px"
        />
      </Field.Root>

      <Field.Root required mb="6">
        <Field.Label color="gray.600">UNIDAD DE MEDIDA *</Field.Label>
        <NativeSelect.Root disabled={cargandoUnidades}>
          <NativeSelect.Field
            value={values.unidad_medida_id}
            onChange={handleUnidadChange}
            maxW="500px"
            borderWidth="2px"
            borderColor="brand.300"
            borderRadius="lg"
            bg="white"
          >
            <option value={0} disabled>
              {cargandoUnidades ? "Cargando..." : "Seleccioná una unidad"}
            </option>
            {unidades.map((unidad) => (
              <option key={unidad.id} value={unidad.id}>
                {unidad.nombre} ({unidad.simbolo})
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>

      <AccionesFormulario>
        <BotonGuardar loading={isLoading} disabled={!values.unidad_medida_id}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}