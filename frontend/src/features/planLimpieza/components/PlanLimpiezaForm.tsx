import { useState } from "react";
import {
  Box,
  Button,
  Field,
  HStack,
  Input,
  NativeSelect,
  Text,
} from "@chakra-ui/react";
import type { PlanLimpiezaInput } from "../services/planLimpiezaService";
import { TIPOS_TAREA, type TipoTarea } from "../types/planLimpieza";
import { useOpcionesPlanLimpieza } from "../hooks/useOpcionesPlanLimpieza";
import {
  BLANCO,
  ERROR_FONDO,
  ERROR_TEXTO,
  FONDO_CARD,
  GRIS_CLARO,
  TEAL,
  TEAL_CLARO,
  TEXTO_PRIMARIO,
  TEXTO_TENUE,
  estiloInput,
  estiloLabel,
} from "../../../common/theme/tokens";

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
  tareas: [
    {
      nombre: "",
      frecuencia: 1,
      tipo: "operacional",
      descripcion: "",
      observaciones: "",
    },
  ],
  equipo_id: 0,
  autor_id: 0,
};

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

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

  const handleTareaTipoChange = (index: number, tipo: TipoTarea) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) => (i === index ? { ...t, tipo } : t)),
    }));

  const handleTareaObservacionesChange = (index: number, observaciones: string) =>
    setValues((prev) => ({
      ...prev,
      tareas: prev.tareas.map((t, i) =>
        i === index ? { ...t, observaciones } : t,
      ),
    }));

  const handleAgregarTarea = () =>
    setValues((prev) => ({
      ...prev,
      tareas: [
        ...prev.tareas,
        {
          nombre: "",
          frecuencia: 1,
          tipo: "operacional",
          descripcion: "",
          observaciones: "",
        },
      ],
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
      style={{
        backgroundColor: BLANCO,
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        marginBottom: "30px",
      }}
    >
      <Box as="h3" style={{ marginTop: 0, fontSize: "22px", color: TEAL }}>
        {title}
      </Box>

      {errorOpciones && (
        <Box
          style={{
            backgroundColor: ERROR_FONDO,
            color: ERROR_TEXTO,
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb",
          }}
        >
          ⚠️ {errorOpciones}
        </Box>
      )}

      {/* Nombre */}
      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>
          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Limpieza diaria de heladeras"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      {/* Tareas, cada una con su propia frecuencia */}
      <Box style={{ marginBottom: "20px" }}>
        <Box as="label" style={estiloLabel}>
          TAREAS *
        </Box>
        {values.tareas.map((tarea, index) => (
          <Box
            key={index}
            style={{
              marginBottom: "14px",
              padding: "12px",
              backgroundColor: FONDO_CARD,
              border: "1px solid #d8e7e5",
              borderRadius: "8px",
            }}
          >
            <HStack
              gap="10px"
              style={{ marginBottom: "8px" }}
              alignItems="flex-end"
            >
              <Box>
                <Box as="label" style={{ ...estiloLabel, fontSize: "12px" }}>
                  NOMBRE DE LA TAREA
                </Box>
                <Input
                  value={tarea.nombre}
                  onChange={(e) =>
                    handleTareaNombreChange(index, e.target.value)
                  }
                  placeholder={`Ej: Limpiar bandeja ${index + 1}`}
                  style={{ ...estiloInput, maxWidth: "320px" }}
                />
              </Box>
              <Box>
                <Box as="label" style={{ ...estiloLabel, fontSize: "12px" }}>
                  FRECUENCIA EN DIAS
                </Box>
                <Input
                  type="number"
                  min={1}
                  value={tarea.frecuencia}
                  onChange={(e) =>
                    handleTareaFrecuenciaChange(index, Number(e.target.value))
                  }
                  placeholder="Frecuencia (días)"
                  title="Frecuencia en días"
                  style={{ ...estiloInput, maxWidth: "140px" }}
                />
              </Box>
              <Box>
                <Box as="label" style={{ ...estiloLabel, fontSize: "12px" }}>
                  TIPO DE TAREA
                </Box>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={tarea.tipo}
                    onChange={(e) =>
                      handleTareaTipoChange(
                        index,
                        e.target.value as TipoTarea,
                      )
                    }
                    style={{ ...estiloSelect, maxWidth: "180px" }}
                  >
                    {TIPOS_TAREA.map((opcion) => (
                      <option
                        key={opcion.value}
                        value={opcion.value}
                        style={{
                          backgroundColor: BLANCO,
                          color: TEXTO_PRIMARIO,
                        }}
                      >
                        {opcion.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Box>
              <Button
                type="button"
                onClick={() => handleQuitarTarea(index)}
                disabled={values.tareas.length === 1}
                style={{
                  backgroundColor: GRIS_CLARO,
                  color: TEXTO_PRIMARIO,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor:
                    values.tareas.length === 1 ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                ✕
              </Button>
            </HStack>
            <Box
              as="label"
              style={{ ...estiloLabel, fontSize: "12px", marginBottom: "4px" }}
            >
              PROCEDIMIENTO (opcional)
            </Box>
            <textarea
              value={tarea.descripcion ?? ""}
              onChange={(e) =>
                handleTareaDescripcionChange(index, e.target.value)
              }
              placeholder={
                "Ej:\n1. Desconectar la energía eléctrica.\n2. Retirar residuos..."
              }
              rows={4}
              style={{
                ...estiloInput,
                maxWidth: "500px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <Box
              as="label"
              style={{
                ...estiloLabel,
                fontSize: "12px",
                marginBottom: "4px",
                marginTop: "8px",
              }}
            >
              OBSERVACIONES (opcional)
            </Box>
            <textarea
              value={tarea.observaciones ?? ""}
              onChange={(e) =>
                handleTareaObservacionesChange(index, e.target.value)
              }
              placeholder="Ej: Usar guantes y verificar la temperatura antes de empezar."
              rows={2}
              style={{
                ...estiloInput,
                maxWidth: "500px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </Box>
        ))}
        <Button
          type="button"
          onClick={handleAgregarTarea}
          style={{
            backgroundColor: TEAL_CLARO,
            color: BLANCO,
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          + Agregar tarea
        </Button>
      </Box>

      <HStack gap="20px" mb="20px" flexWrap="wrap" alignItems="flex-start">
        {/* Equipo */}
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            EQUIPO *
          </Box>
          <NativeSelect.Root disabled={cargandoOpciones}>
            <NativeSelect.Field
              value={values.equipo_id}
              onChange={handleEquipoChange}
              style={estiloSelect}
            >
              <option value={0} disabled>
                {cargandoOpciones ? "Cargando..." : "Seleccioná un equipo"}
              </option>
              {equipos.map((equipo) => (
                <option
                  key={equipo.id}
                  value={equipo.id}
                  style={{ backgroundColor: BLANCO, color: TEXTO_PRIMARIO }}
                >
                  {equipo.nombre}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </HStack>

      {/* Autor */}
      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            AUTOR *
          </Box>
          <NativeSelect.Root disabled={cargandoOpciones}>
            <NativeSelect.Field
              value={values.autor_id}
              onChange={handleAutorChange}
              style={estiloSelect}
            >
              <option value={0} disabled>
                {cargandoOpciones
                  ? "Cargando..."
                  : "Seleccioná quién crea el plan"}
              </option>
              {personal.map((persona) => (
                <option
                  key={persona.id}
                  value={persona.id}
                  style={{ backgroundColor: BLANCO, color: TEXTO_PRIMARIO }}
                >
                  {persona.nombre} {persona.apellido || ""}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        <Text style={{ fontSize: "12px", color: TEXTO_TENUE, marginTop: "6px" }}>
          Se guarda de forma explícita porque el sistema todavía no tiene sesión
          de usuario.
        </Text>
      </Box>

      {/* Botones */}
      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          disabled={!values.equipo_id || !values.autor_id || hayTareaInvalida}
          style={{
            backgroundColor: TEAL,
            color: "white",
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          {submitLabel}
        </Button>

        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            style={{
              backgroundColor: GRIS_CLARO,
              color: TEXTO_PRIMARIO,
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "bold",
            }}
          >
            Cancelar
          </Button>
        )}
      </HStack>
    </Box>
  );
}
