import { useState } from "react";
import { Button, HStack, Stack, Textarea } from "@chakra-ui/react";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import type { PlanLimpiezaInput } from "../services/planLimpiezaService";
import { useOpcionesPlanLimpieza } from "../hooks/useOpcionesPlanLimpieza";
import {
  AccionesFormulario,
  BannerError,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  FormNativeSelect,
  SelectPlaceholder,
  TarjetaFormulario,
  TituloFormulario,
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
 * El aspecto de los controles lo dan `FormInput` y `FormNativeSelect`: este
 * último arma el `NativeSelect.Root`/`Indicator` para que el desplegable
 * tenga el mismo lenguaje visual que los inputs.
 */
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
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      {errorOpciones && <BannerError>{errorOpciones}</BannerError>}

      <FormField label="Nombre" required mb="4">
        <FormInput
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Limpieza diaria de heladeras"
          maxW="500px"
        />
      </FormField>

      {/*
        Tareas, cada una con su propia frecuencia.

        Los controles de cada tarea ocupan todo el ancho del recuadro. Antes
        venían con `maxW="500px"`, que es el ancho pensado para un campo de
        formulario suelto: como acá cada tarea ya es un recuadro anidado,
        quedaban pegados al borde izquierdo con medio recuadro de aire a la
        derecha.
      */}
      <FormField label="Tareas" required mb="4">
        {/*
          `w="100%"` explícito: `Field.Root` usa `align-items: flex-start`, así
          que un `Stack` sin ancho se ajusta al contenido y las tareas quedan
          angostas contra el borde izquierdo.
        */}
        <Stack gap="4" w="100%">
          {values.tareas.map((tarea, index) => (
            <Stack
              key={index}
              gap="4"
              p="4"
              w="100%"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="lg"
            >
              <FormField label="Nombre de la tarea" mb="0">
                <FormInput
                  value={tarea.nombre}
                  onChange={(e) =>
                    handleTareaNombreChange(index, e.target.value)
                  }
                  placeholder={`Ej: Limpiar bandeja ${index + 1}`}
                />
              </FormField>

              <FormField
                label="Frecuencia en días"
                helper="Cada cuántos días se repite."
                mb="0"
              >
                <FormInput
                  type="number"
                  min={1}
                  value={tarea.frecuencia}
                  onChange={(e) =>
                    handleTareaFrecuenciaChange(index, Number(e.target.value))
                  }
                  placeholder="Frecuencia (días)"
                  title="Frecuencia en días"
                />
              </FormField>

              <FormField label="Procedimiento (opcional)" mb="0">
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
                />
              </FormField>

              <HStack justify="flex-end">
                <BotonCancelar
                  aria-label={`Quitar tarea ${index + 1}`}
                  onClick={() => handleQuitarTarea(index)}
                  disabled={values.tareas.length === 1}
                >
                  <LuTrash2 aria-hidden />
                  Quitar tarea
                </BotonCancelar>
              </HStack>
            </Stack>
          ))}
        </Stack>
      </FormField>

      <Button
        type="button"
        variant="outline"
        colorPalette="brand"
        size="sm"
        mb="6"
        onClick={handleAgregarTarea}
      >
        <LuPlus aria-hidden />
        Agregar tarea
      </Button>

      <FormField label="Equipo" required mb="4">
        <FormNativeSelect
          value={values.equipo_id}
          onChange={handleEquipoChange}
          disabled={cargandoOpciones}
          maxW="500px"
        >
          <SelectPlaceholder value={0}>
            {cargandoOpciones ? "Cargando..." : "Seleccioná un equipo"}
          </SelectPlaceholder>
          {equipos.map((equipo) => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      <FormField
        label="Autor"
        required
        helper="Se guarda de forma explícita porque el sistema todavía no tiene sesión de usuario."
        mb="0"
      >
        <FormNativeSelect
          value={values.autor_id}
          onChange={handleAutorChange}
          disabled={cargandoOpciones}
          maxW="500px"
        >
          <SelectPlaceholder value={0}>
            {cargandoOpciones ? "Cargando..." : "Seleccioná quién crea el plan"}
          </SelectPlaceholder>
          {personal.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.nombre} {persona.apellido || ""}
            </option>
          ))}
        </FormNativeSelect>
      </FormField>

      <AccionesFormulario>
        <BotonGuardar
          loading={isLoading}
          disabled={!values.equipo_id || !values.autor_id || hayTareaInvalida}
        >
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}