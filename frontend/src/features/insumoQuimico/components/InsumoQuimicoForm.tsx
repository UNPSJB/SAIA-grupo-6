import { useState, useEffect } from "react";
import { Box, Button, Field, HStack, Input, NativeSelect } from "@chakra-ui/react";
import {
  TIPOS_QUIMICOS,
  type InsumoQuimicoFormValues,
  type TipoQuimico,
} from "../types/insumoQuimico";
import { listarUnidadesMedida } from "../../unidadMedida/services/unidadMedidaService";
import type { UnidadMedida } from "../../unidadMedida/types/unidadMedida";
import {
  BLANCO,
  GRIS_CLARO,
  TEAL,
  TEXTO_PRIMARIO,
  estiloInput,
  estiloLabel,
} from "../../../common/theme/tokens";

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

const estiloSelect = {
  ...estiloInput,
  boxSizing: "border-box" as const,
  colorScheme: "light" as const,
  height: "auto" as const,
  lineHeight: "normal" as const,
};

export function InsumoQuimicoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Insumo Químico",
  onCancel,
}: InsumoQuimicoFormProps) {
  const [values, setValues] = useState<InsumoQuimicoFormValues>(initialValues);
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
    onSubmit(values);
  };

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
      <Box
        as="h3"
        style={{
          marginTop: 0,
          fontSize: "22px",
          color: TEAL,
        }}
      >
        {title}
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            NOMBRE *
          </Box>
          <Input
            value={values.nombre}
            onChange={handleNombreChange}
            placeholder="Ej: Detergente Industrial Concentrado"
            style={estiloInput}
          />
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "20px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            TIPO DE PRODUCTO QUÍMICO *
          </Box>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.tipo}
              onChange={handleTipoChange}
              style={estiloSelect}
            >
              {TIPOS_QUIMICOS.map((tipo) => (
                <option
                  key={tipo.value}
                  value={tipo.value}
                  style={{
                    backgroundColor: BLANCO,
                    color: TEXTO_PRIMARIO,
                  }}
                >
                  {tipo.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      <Box style={{ marginBottom: "25px" }}>
        <Field.Root required>
          <Box as="label" style={estiloLabel}>
            UNIDAD DE MEDIDA *
          </Box>
          <NativeSelect.Root disabled={cargandoUnidades}>
            <NativeSelect.Field
              value={values.unidad_medida_id}
              onChange={handleUnidadChange}
              style={estiloSelect}
            >
              <option value={0} disabled>
                {cargandoUnidades ? "Cargando..." : "Seleccioná una unidad"}
              </option>
              {unidades.map((unidad) => (
                <option
                  key={unidad.id}
                  value={unidad.id}
                  style={{
                    backgroundColor: BLANCO,
                    color: TEXTO_PRIMARIO,
                  }}
                >
                  {unidad.nombre} ({unidad.simbolo})
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </Box>

      <HStack style={{ gap: "15px" }}>
        <Button
          type="submit"
          loading={isLoading}
          disabled={!values.unidad_medida_id}
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
