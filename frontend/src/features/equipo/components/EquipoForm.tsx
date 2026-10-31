import { useState } from "react";
import { Box, Switch } from "@chakra-ui/react";
import type { EquipoInput } from "../types/equipo";
import type { SectorResumen } from "../../sector/types/sector";
import { useSectores } from "../../sector/hooks/useSectores";
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

type EquipoFormValues = EquipoInput;

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
  /** Sector actual del equipo: se muestra aunque haya sido dado de baja. */
  sectorActual?: SectorResumen;
}

const emptyValues: EquipoFormValues = {
  nombre: "",
  tipo: "",
  sector_id: 0,
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
  sectorActual,
}: EquipoFormProps) {
  const [values, setValues] = useState<EquipoFormValues>(initialValues);
  const { sectores, loading: cargandoSectores } = useSectores();

  // Si el sector del equipo se dio de baja, igual tiene que aparecer en la lista.
  const opcionesSector =
    sectorActual && !sectores.some((s) => s.id === sectorActual.id)
      ? [...sectores, sectorActual]
      : sectores;

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

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((prev) => ({
      ...prev,
      sector_id: Number(e.target.value),
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

      {/* Sector */}
      <FormField label="Sector" required mb={mostrarBaja ? "4" : "0"}>
        <FormNativeSelect
          value={values.sector_id}
          onChange={handleSectorChange}
          disabled={cargandoSectores}
          maxW="500px"
        >
          <SelectPlaceholder>
            {cargandoSectores ? "Cargando sectores..." : "Seleccioná un sector"}
          </SelectPlaceholder>
          {opcionesSector.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.nombre}
            </option>
          ))}
        </FormNativeSelect>
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
        <BotonGuardar loading={isLoading} disabled={!values.sector_id}>
          {submitLabel}
        </BotonGuardar>
        {onCancel && <BotonCancelar onClick={onCancel}>Cancelar</BotonCancelar>}
      </AccionesFormulario>
    </TarjetaFormulario>
  );
}