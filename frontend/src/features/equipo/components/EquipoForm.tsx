import { useState } from "react";
import { Box, Switch } from "@chakra-ui/react";
import type { Equipo } from "../types/equipo";
import {
  AccionesFormulario,
  BotonCancelar,
  BotonGuardar,
  FormField,
  FormInput,
  TarjetaFormulario,
  TituloFormulario,
} from "../../../components/ui/patrones";

type EquipoFormValues = Omit<Equipo, "id">;

interface EquipoFormProps {
  initialValues?: EquipoFormValues;
  onSubmit: (values: EquipoFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  title?: string;
  onCancel?: () => void;
  mostrarBaja?: boolean;
  /** La baja requiere confirmación: la pide la página, no el formulario. */
  onSolicitarBaja?: () => void;
  /** El usuario confirmó la baja y el formulario puede aplicarla. */
  bajaConfirmada?: boolean;
}

const emptyValues: EquipoFormValues = {
  nombre: "",
  tipo: "",
  ubicacion: "",
  activo: true,
};

/**
 * El aspecto del input lo aporta la receta `input` del tema
 * (`src/theme/index.ts`), así que acá no hay ningún objeto de estilo. El
 * ancho (`maxW="500px"`) sí es una decisión de layout y queda como prop.
 */
export function EquipoForm({
  initialValues = emptyValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Guardar",
  title = "Alta de Equipo",
  onCancel,
  mostrarBaja = false,
  onSolicitarBaja,
  bajaConfirmada = false,
}: EquipoFormProps) {
  const [values, setValues] = useState<EquipoFormValues>(initialValues);

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      nombre: e.target.value,
    }));

  const handleTipoChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      tipo: e.target.value,
    }));

  const handleUbicacionChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({
      ...prev,
      ubicacion: e.target.value,
    }));

  const handleBajaChange = (checked: boolean) => {
    // Dar de baja es una baja lógica con efectos (el equipo desaparece de los
    // listados), así que no se aplica en silencio: la página pide confirmación
    // con su `ConfirmDialog` y recién entonces confirma este flag. Antes el
    // switch escribía `activo: false` directo y salteaba la confirmación que
    // sí exige la tabla.
    if (onSolicitarBaja) {
      onSolicitarBaja();
      return;
    }
    setValues((prev) => ({ ...prev, activo: !checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Se aplica la baja acá y no en un efecto: si la página ya la confirmó,
    // el `activo: false` viaja en este submit sin un render de más.
    onSubmit(bajaConfirmada ? { ...values, activo: false } : values);
  };

  return (
    <TarjetaFormulario as="form" onSubmit={handleSubmit}>
      <TituloFormulario>{title}</TituloFormulario>

      {/* Nombre */}
      <FormField label="Nombre" required mb="4">
        <FormInput
          value={values.nombre}
          onChange={handleNombreChange}
          placeholder="Ej: Heladera industrial"
          maxW="500px"
        />
      </FormField>

      {/* Tipo */}
      <FormField label="Tipo" required mb="4">
        <FormInput
          value={values.tipo}
          onChange={handleTipoChange}
          placeholder="Ej: Heladera, horno, freidora..."
          maxW="500px"
        />
      </FormField>

      {/* Ubicación */}
      <FormField label="Ubicación" required mb={mostrarBaja ? "4" : "0"}>
        <FormInput
          value={values.ubicacion}
          onChange={handleUbicacionChange}
          placeholder="Ej: Sector A - Laboratorio"
          maxW="500px"
        />
      </FormField>

      {/* Dar de baja - solo aparece al modificar */}
      {mostrarBaja && (
        <Box mb="0">
          <Switch.Root
            checked={!values.activo || bajaConfirmada}
            onCheckedChange={(details) => handleBajaChange(details.checked)}
            colorPalette={values.activo && !bajaConfirmada ? "green" : "red"}
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm" fontWeight="bold" color="fg.muted">
              Dar de baja
            </Switch.Label>
          </Switch.Root>
        </Box>
      )}

      {/* Botones */}
      <AccionesFormulario>
        <BotonGuardar loading={isLoading}>{submitLabel}</BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}
