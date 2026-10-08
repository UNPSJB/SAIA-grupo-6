import { useState } from "react";
import {
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { PlanLimpiezaInput } from "../services/planLimpiezaService";
import { useOpcionesPlanLimpieza } from "../hooks/useOpcionesPlanLimpieza";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
} from "../../../components/ui/patrones";

interface PlanLimpiezaFormProps {
  initialValues?: PlanLimpiezaInput;
  onSubmit: (values: PlanLimpiezaInput) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
}

const emptyValues: PlanLimpiezaInput = {
  nombre: "",
  tareas: [{ nombre: "", frecuencia: 1, descripcion: "" }],
  equipo_id: 0,
  autor_id: 0,
};

/**
 * `NativeSelect.Field` no consume la receta `input` del tema (solo los
 * `<Input>`/`<Textarea>` de Chakra la toman), así que el borde y el fondo
 * hay que pasarlos a mano.
 */
const propsSelect = {
  bg: "white",
  borderWidth: "2px",
  borderColor: "brand.300",
  rounded: "lg",
  maxW: "500px",
} as const;

export function PlanLimpiezaForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Plan de Limpieza",
  onCancel,
}: PlanLimpiezaFormProps) {
  const [values, setValues] = useState<PlanLimpiezaInput>(initialValues);
  const {
    equipos,
    personal,
    loading: cargandoOpciones,
    error: errorOpciones,
  } = useOpcionesPlanLimpieza();

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, nombre: e.target.value }));

  const handleEquipoChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, equipo_id: Number(e.target.value) }));

  const handleAutorChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({ ...prev, autor_id: Number(e.target.value) }));

  // Las tareas ahora son propias de este plan: se cargan como una lista
  // editable, no como un <select> sobre un catálogo compartido. Cada una
  // tiene su propio nombre y su propia frecuencia (en días).
  const handleTareaNombreChange = (index: number, nombre: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) => (i === index ? { ...t, nombre } : t)),
    }));

  const handleTareaDescripcionChange = (index: number, descripcion: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, descripcion } : t,
      ),
    }));

  const handleTareaFrecuenciaChange = (index: number, frecuencia: number) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, frecuencia } : t,
      ),
    }));

  const handleAgregarTarea = () =>
    setValues((prev) => ({
      ...prev,
      tareas: [...prev.tareas, { nombre: "", frecuencia: 1, descripcion: "" }],
    }));

  const handleQuitarTarea = (index: number) =>
    setValues((prev) => ({
      ...prev,
      tareas:
        prev.tareas.length > 1
          ? prev.tareas.filter((_, i) => i !== index)
          : prev.tareas,
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const hayTareaInvalida = values.tareas.some(
    (t) => !t.nombre.trim() || !t.frecuencia || t.frecuencia <= 0,
  );

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
      <Heading as="h3" mt={0} size="lg" color="brand.500" fontWeight="bold" mb="6">
        {title}
      </Heading>

      {errorOpciones && <BannerError>{errorOpciones}</BannerError>}

      <Field.Root required mb="5">
        <Field.Label color="gray.600">NOMBRE *</Field.Label>
        <Input
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Limpieza diaria de heladeras"
          maxW="500px"
        />
      </Field.Root>

      {/* Tareas, cada una con su propia frecuencia */}
      <Field.Root required mb="5">
        <Field.Label color="gray.600">TAREAS *</Field.Label>
        <Stack gap="3.5">
          {values.tareas.map((tarea, index) => (
            <Box
              key={index}
              p="3"
              bg="gray.50"
              borderWidth="1px"
              borderColor="brand.100"
              rounded="lg"
            >
              <HStack gap="2.5" align="end" mb="2" flexWrap="wrap">
                <Field.Root>
                  <Field.Label color="gray.600" fontSize="xs">
                    NOMBRE DE LA TAREA
                  </Field.Label>
                  <Input
                    value={tarea.nombre}
                    onChange={(e) =>
                      handleTareaNombreChange(index, e.target.value)
                    }
                    placeholder={`Ej: Limpiar bandeja ${index + 1}`}
                    maxW="320px"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label color="gray.600" fontSize="xs">
                    FRECUENCIA EN DIAS
                  </Field.Label>
                  <Input
                    type="number"
                    min={1}
                    value={tarea.frecuencia}
                    onChange={(e) =>
                      handleTareaFrecuenciaChange(index, Number(e.target.value))
                    }
                    placeholder="Frecuencia (días)"
                    title="Frecuencia en días"
                    maxW="140px"
                  />
                </Field.Root>
                <BotonCancelar
                  aria-label={`Quitar tarea ${index + 1}`}
                  fontWeight="bold"
                  px="3.5"
                  py="2.5"
                  onClick={() => handleQuitarTarea(index)}
                  disabled={values.tareas.length === 1}
                >
                  ✕
                </BotonCancelar>
              </HStack>
              <Field.Root>
                <Field.Label color="gray.600" fontSize="xs" mb="1">
                  PROCEDIMIENTO (opcional)
                </Field.Label>
                <Textarea
                  value={tarea.descripcion ?? ""}
                  onChange={(e) =>
                    handleTareaDescripcionChange(index, e.target.value)
                  }
                  placeholder={
                    "Ej:\n1. Desconectar la energía eléctrica.\n2. Retirar residuos..."
                  }
                  rows={4}
                  resize="vertical"
                  maxW="500px"
                />
              </Field.Root>
            </Box>
          ))}
        </Stack>
        <Button
          type="button"
          variant="outline"
          colorPalette="brand"
          rounded="lg"
          fontWeight="bold"
          px="4"
          py="2"
          mt="3"
          onClick={handleAgregarTarea}
        >
          + Agregar tarea
        </Button>
      </Field.Root>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">EQUIPO *</Field.Label>
        <NativeSelect.Root disabled={cargandoOpciones}>
          <NativeSelect.Field
            value={values.equipo_id}
            onChange={handleEquipoChange}
            {...propsSelect}
          >
            <option value={0} disabled>
              {cargandoOpciones ? "Cargando..." : "Seleccioná un equipo"}
            </option>
            {equipos.map((equipo) => (
              <option key={equipo.id} value={equipo.id}>
                {equipo.nombre}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>

      <Field.Root required mb="5">
        <Field.Label color="gray.600">AUTOR *</Field.Label>
        <NativeSelect.Root disabled={cargandoOpciones}>
          <NativeSelect.Field
            value={values.autor_id}
            onChange={handleAutorChange}
            {...propsSelect}
          >
            <option value={0} disabled>
              {cargandoOpciones
                ? "Cargando..."
                : "Seleccioná quién crea el plan"}
            </option>
            {personal.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre} {persona.apellido || ""}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text fontSize="xs" color="gray.400" mt={0}>
          Se guarda de forma explícita porque el sistema todavía no tiene sesión
          de usuario.
        </Text>
      </Field.Root>

      <AccionesFormulario>
        <BotonGuardar
          loading={isLoading}
          disabled={!values.equipo_id || !values.autor_id || hayTareaInvalida}
        >
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </Box>
  );
}